from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.test import Test, TestQuestion, TestAssignment
from app.models.teacher import Teacher
from app.models.user import User
from app.schemas.test import TestCreate, TestUpdate, TestOut, TestQuestionAdd, TestAssignmentCreate, TestAssignmentOut
from app.dependencies import require_teacher, require_admin

router = APIRouter(prefix="/api/tests", tags=["tests"])


async def _get_teacher_id(current_user: User, db: AsyncSession) -> int | None:
    if current_user.role.value in ("teacher",):
        result = await db.execute(select(Teacher).where(Teacher.user_id == current_user.id))
        t = result.scalar_one_or_none()
        return t.id if t else None
    return None


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
