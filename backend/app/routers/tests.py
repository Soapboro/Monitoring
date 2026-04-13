from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.test import Test, TestQuestion, TestAssignment
from app.models.question import Question
from app.models.student import Student
from app.models.test_session import TestSession, SessionStatus
from app.models.teacher import Teacher
from app.models.user import User
from app.schemas.test import TestCreate, TestUpdate, TestOut, TestQuestionAdd, TestAssignmentCreate, TestAssignmentOut
from app.dependencies import require_teacher, require_admin, get_current_user, require_student

router = APIRouter(prefix="/api/tests", tags=["tests"])


async def _get_teacher_id(current_user: User, db: AsyncSession) -> int | None:
    if current_user.role.value in ("teacher",):
        result = await db.execute(select(Teacher).where(Teacher.user_id == current_user.id))
        t = result.scalar_one_or_none()
        return t.id if t else None
    return None


@router.get("/my-available")
async def my_available_tests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_student),
):
    """Тесты, доступные для прохождения текущим студентом."""
    # Получаем студента
    st_result = await db.execute(select(Student).where(Student.user_id == current_user.id))
    student = st_result.scalar_one_or_none()
    if not student:
        return []

    now = datetime.utcnow()

    # Назначения тестов на группу студента
    ta_result = await db.execute(
        select(TestAssignment)
        .options(selectinload(TestAssignment.test))
        .where(TestAssignment.group_id == student.group_id)
    )
    assignments = ta_result.scalars().all()

    # Сессии студента сгруппированные по test_id
    sess_result = await db.execute(
        select(TestSession).where(TestSession.student_id == student.id)
    )
    sessions = sess_result.scalars().all()
    by_test: dict[int, list[TestSession]] = {}
    for s in sessions:
        by_test.setdefault(s.test_id, []).append(s)

    out = []
    for ta in assignments:
        test = ta.test
        if test.status.value != "published":
            continue

        # Проверяем даты доступности (приоритет у TestAssignment, иначе у Test)
        avail_from = ta.available_from or test.available_from
        avail_to = ta.available_to or test.available_to
        if avail_from and now < avail_from.replace(tzinfo=None):
            continue
        if avail_to and now > avail_to.replace(tzinfo=None):
            status = "expired"
        else:
            status = "available"

        test_sessions = by_test.get(test.id, [])
        attempts_used = len(test_sessions)
        completed = [s for s in test_sessions if s.status == SessionStatus.completed]
        in_progress = next((s for s in test_sessions if s.status == SessionStatus.in_progress), None)
        passed = any(s.passed for s in completed)

        if in_progress:
            status = "in_progress"
        elif passed:
            status = "passed"
        elif attempts_used >= test.attempts_allowed and not in_progress:
            status = "exhausted"

        out.append({
            "test_id": test.id,
            "title": test.title,
            "description": test.description,
            "subject_id": test.subject_id,
            "time_limit_minutes": test.time_limit_minutes,
            "attempts_allowed": test.attempts_allowed,
            "attempts_used": attempts_used,
            "passing_score_pct": float(test.passing_score_pct),
            "available_from": (ta.available_from or test.available_from),
            "available_to": (ta.available_to or test.available_to),
            "status": status,
            "session_id": in_progress.id if in_progress else None,
            "best_pct": max(
                (round(float(s.score_total or 0) / float(s.score_max) * 100, 1)
                 for s in completed if s.score_max),
                default=None,
            ),
        })

    return out


@router.get("", response_model=list[TestOut])
async def list_tests(
    subject_id: int | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    query = select(Test).order_by(Test.created_at.desc())
    if subject_id:
        query = query.where(Test.subject_id == subject_id)
    if status:
        query = query.where(Test.status == status)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=TestOut, status_code=201)
async def create_test(
    data: TestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    author_id = await _get_teacher_id(current_user, db)
    test = Test(**data.model_dump(), author_id=author_id)
    db.add(test)
    await db.commit()
    await db.refresh(test)
    return test


@router.get("/{test_id}", response_model=TestOut)
async def get_test(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")
    return test


@router.patch("/{test_id}", response_model=TestOut)
async def update_test(
    test_id: int,
    data: TestUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(test, field, value)
    await db.commit()
    await db.refresh(test)
    return test


@router.delete("/{test_id}/assignments/{assignment_id}", status_code=204)
async def remove_test_assignment(
    test_id: int,
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(
        select(TestAssignment).where(
            TestAssignment.id == assignment_id,
            TestAssignment.test_id == test_id,
        )
    )
    ta = result.scalar_one_or_none()
    if not ta:
        raise HTTPException(status_code=404, detail="Не найдено")
    await db.delete(ta)
    await db.commit()


@router.delete("/{test_id}", status_code=204)
async def delete_test(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")
    await db.delete(test)
    await db.commit()


# --- Questions in test ---

@router.get("/{test_id}/questions")
async def get_test_questions(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(
        select(TestQuestion)
        .options(selectinload(TestQuestion.question))
        .where(TestQuestion.test_id == test_id)
        .order_by(TestQuestion.order_num)
    )
    tqs = result.scalars().all()
    out = []
    for tq in tqs:
        q = tq.question
        out.append({
            "tq_id": tq.id,
            "order_num": tq.order_num,
            "score_max": float(tq.score_max) if tq.score_max is not None else float(q.score_max),
            "id": q.id,
            "topic_id": q.topic_id,
            "question_type": q.question_type.value,
            "difficulty": q.difficulty.value,
            "body": q.body,
            "image_url": q.image_url,
            "explanation": q.explanation,
            "options": q.options,
            "is_active": q.is_active,
        })
    return out


@router.get("/{test_id}/assignments")
async def get_test_assignments(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(
        select(TestAssignment).where(TestAssignment.test_id == test_id)
    )
    return result.scalars().all()


@router.post("/{test_id}/questions", status_code=201)
async def add_question_to_test(
    test_id: int,
    data: TestQuestionAdd,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Test).where(Test.id == test_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Тест не найден")
    tq = TestQuestion(test_id=test_id, **data.model_dump())
    db.add(tq)
    await db.commit()
    return {"ok": True}


@router.delete("/{test_id}/questions/{question_id}", status_code=204)
async def remove_question_from_test(
    test_id: int,
    question_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(
        select(TestQuestion).where(
            TestQuestion.test_id == test_id,
            TestQuestion.question_id == question_id,
        )
    )
    tq = result.scalar_one_or_none()
    if not tq:
        raise HTTPException(status_code=404, detail="Не найдено")
    await db.delete(tq)
    await db.commit()


# --- Assignments ---

@router.post("/{test_id}/assign", response_model=TestAssignmentOut, status_code=201)
async def assign_test_to_group(
    test_id: int,
    data: TestAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    teacher_id = await _get_teacher_id(current_user, db)
    ta = TestAssignment(
        test_id=test_id,
        group_id=data.group_id,
        assigned_by=teacher_id,
        available_from=data.available_from,
        available_to=data.available_to,
    )
    db.add(ta)
    await db.commit()
    await db.refresh(ta)
    return ta
