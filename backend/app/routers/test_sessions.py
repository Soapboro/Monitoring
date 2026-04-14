import random
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.test import Test, TestQuestion
from app.models.test_session import TestSession, SessionStatus, QuestionAnswer
from app.models.question import Question, Difficulty
from app.models.topic import Topic
from app.models.adaptive import AdaptiveRecommendation
from app.models.student import Student
from app.models.user import User
from app.models.grade import Grade, GradeType
from app.models.teaching_assignment import TeachingAssignment
from app.schemas.test_session import AnswerSubmit, SessionOut, SessionResultOut
from app.dependencies import get_current_user, require_student, require_teacher

router = APIRouter(prefix="/api/sessions", tags=["test-sessions"])


async def _get_student(current_user: User, db: AsyncSession) -> Student:
    result = await db.execute(select(Student).where(Student.user_id == current_user.id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=403, detail="Профиль студента не найден")
    return student


def _check_answers(question: Question, answer_data: dict) -> tuple[float, bool]:
    """Проверяет ответ и возвращает (score_earned, is_correct)."""
    options = question.options or {}
    correct_ids = set(options.get("correct", []))
    q_type = question.question_type.value

    if q_type == "single_choice":
        given = answer_data.get("selected")
        is_correct = str(given) in {str(c) for c in correct_ids}
        return (float(question.score_max) if is_correct else 0.0, is_correct)

    elif q_type == "multiple_choice":
        given = set(str(x) for x in answer_data.get("selected", []))
        correct = set(str(c) for c in correct_ids)
        is_correct = given == correct
        if is_correct:
            return float(question.score_max), True
        if given and given.issubset(correct):
            partial = float(question.score_max) * len(given) / len(correct)
            return round(partial, 2), False
        return 0.0, False

    elif q_type == "text_input":
        given = str(answer_data.get("text", "")).strip().lower()
        correct_texts = [str(c).strip().lower() for c in options.get("correct_texts", [])]
        is_correct = given in correct_texts
        return (float(question.score_max) if is_correct else 0.0, is_correct)

    elif q_type == "matching":
        correct_pairs = options.get("correct", {})  # {"l1": "r1", ...}
        given_pairs = answer_data.get("pairs", {})
        if not correct_pairs:
            return 0.0, False
        total = len(correct_pairs)
        correct_count = sum(
            1 for k, v in given_pairs.items()
            if str(correct_pairs.get(str(k))) == str(v)
        )
        is_correct = correct_count == total
        score = round(float(question.score_max) * correct_count / total, 2) if total > 0 else 0.0
        return score, is_correct

    # ordering — ручная проверка не реализована
    return 0.0, False


@router.post("/start/{test_id}", response_model=SessionOut)
async def start_session(
    test_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_student),
):
    student = await _get_student(current_user, db)

    # Загружаем тест
    result = await db.execute(
        select(Test).options(selectinload(Test.test_questions).selectinload(TestQuestion.question))
        .where(Test.id == test_id)
    )
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")
    if test.status.value != "published":
        raise HTTPException(status_code=400, detail="Тест недоступен")

    now = datetime.utcnow()
    if test.available_from and now < test.available_from.replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="Тест ещё не открыт")
    if test.available_to and now > test.available_to.replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="Время тестирования истекло")

    # Счётчик попыток
    count_result = await db.execute(
        select(func.count()).where(
            TestSession.test_id == test_id,
            TestSession.student_id == student.id,
        )
    )
    attempts_used = count_result.scalar()
    if attempts_used >= test.attempts_allowed:
        raise HTTPException(status_code=400, detail="Исчерпано количество попыток")

    # Формируем порядок вопросов
    tqs = list(test.test_questions)
    if test.shuffle_questions:
        random.shuffle(tqs)
    if test.questions_count:
        tqs = tqs[:test.questions_count]
    question_order = [tq.question_id for tq in tqs]

    ip = request.client.host if request.client else None

    session = TestSession(
        test_id=test_id,
        student_id=student.id,
        attempt_number=attempts_used + 1,
        status=SessionStatus.in_progress,
        question_order=question_order,
        ip_address=ip,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.post("/{session_id}/answer")
async def submit_answer(
    session_id: int,
    data: AnswerSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_student),
):
    student = await _get_student(current_user, db)

    result = await db.execute(
        select(TestSession).where(
            TestSession.id == session_id,
            TestSession.student_id == student.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    if session.status != SessionStatus.in_progress:
        raise HTTPException(status_code=400, detail="Сессия уже завершена")

    q_result = await db.execute(select(Question).where(Question.id == data.question_id))
    question = q_result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Вопрос не найден")

    score_earned, is_correct = _check_answers(question, data.answer_data)

    existing = await db.execute(
        select(QuestionAnswer).where(
            QuestionAnswer.session_id == session_id,
            QuestionAnswer.question_id == data.question_id,
        )
    )
    answer = existing.scalar_one_or_none()
    if answer:
        answer.answer_data = data.answer_data
        answer.score_earned = score_earned
        answer.is_correct = is_correct
        answer.time_spent_sec = data.time_spent_sec
    else:
        answer = QuestionAnswer(
            session_id=session_id,
            question_id=data.question_id,
            answer_data=data.answer_data,
            score_earned=score_earned,
            is_correct=is_correct,
            time_spent_sec=data.time_spent_sec,
        )
        db.add(answer)

    await db.commit()
    return {"score_earned": score_earned, "is_correct": is_correct}


@router.post("/{session_id}/finish", response_model=SessionOut)
async def finish_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_student),
):
    student = await _get_student(current_user, db)

    result = await db.execute(
        select(TestSession)
        .options(selectinload(TestSession.answers), selectinload(TestSession.test))
        .where(TestSession.id == session_id, TestSession.student_id == student.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    if session.status != SessionStatus.in_progress:
        raise HTTPException(status_code=400, detail="Сессия уже завершена")

    # Считаем итог
    tq_result = await db.execute(
        select(TestQuestion).where(TestQuestion.test_id == session.test_id)
    )
    tqs = tq_result.scalars().all()
    score_max = sum(
        float(tq.score_max) if tq.score_max is not None else float(tq.question.score_max if hasattr(tq, "question") else 1)
        for tq in tqs
    )

    # Пересчитаем score_max из вопросов напрямую
    q_ids = session.question_order or []
    if q_ids:
        qs_result = await db.execute(select(Question).where(Question.id.in_(q_ids)))
        questions = qs_result.scalars().all()
        score_max = sum(float(q.score_max) for q in questions)

    score_total = sum(float(a.score_earned or 0) for a in session.answers)
    pct = (score_total / score_max * 100) if score_max > 0 else 0
    passed = pct >= float(session.test.passing_score_pct)

    session.status = SessionStatus.completed
    session.finished_at = datetime.utcnow()
    session.score_total = score_total
    session.score_max = score_max
    session.passed = passed

    await db.commit()

    # Автоматически создаём оценку по результату теста
    await _auto_grade(db, session, student, pct, passed)

    # Обновляем adaptive_recommendations по темам затронутых вопросов
    await _update_adaptive(db, student.id, session.answers, questions if q_ids else [])

    await db.refresh(session)
    return session


async def _auto_grade(
    db: AsyncSession,
    session: TestSession,
    student: Student,
    pct: float,
    passed: bool,
) -> None:
    """1 оценка на тест. При нескольких попытках сохраняется лучший результат."""
    # Ищем учебное назначение: предмет теста + группа студента
    asgn_q = await db.execute(
        select(TeachingAssignment).where(
            TeachingAssignment.subject_id == session.test.subject_id,
            TeachingAssignment.group_id == student.group_id,
        )
    )
    assignment = asgn_q.scalars().first()
    if not assignment:
        return  # нет подходящего назначения — пропускаем

    # Переводим процент в 5-балльную шкалу
    if pct >= 80:
        value = 5.0
    elif pct >= 60:
        value = 4.0
    elif pct >= 40:
        value = 3.0
    else:
        value = 2.0

    # Ищем существующую оценку за этот тест (любая попытка)
    existing_q = await db.execute(
        select(Grade)
        .join(TestSession, Grade.session_id == TestSession.id)
        .where(
            Grade.student_id == student.id,
            Grade.assignment_id == assignment.id,
            TestSession.test_id == session.test_id,
        )
    )
    existing = existing_q.scalars().first()

    if existing:
        # Обновляем только если текущая попытка лучше
        if value > float(existing.value or 0):
            existing.value = value
            existing.passed = passed
            existing.session_id = session.id
            existing.comment = f"Авто (лучшая попытка): {session.test.title}"
            existing.date_recorded = date.today()
            await db.commit()
    else:
        grade = Grade(
            student_id=student.id,
            assignment_id=assignment.id,
            grade_type=GradeType.test,
            value=value,
            passed=passed,
            comment=f"Авто: {session.test.title}",
            date_recorded=date.today(),
            recorded_by=assignment.teacher_id,
            session_id=session.id,
        )
        db.add(grade)
        await db.commit()


async def _update_adaptive(
    db: AsyncSession,
    student_id: int,
    answers: list[QuestionAnswer],
    questions: list[Question],
) -> None:
    """Пересчитывает mastery_level и рекомендованную сложность по каждой теме."""
    if not questions:
        return

    q_by_id = {q.id: q for q in questions}

    # Группируем ответы по topic_id
    topic_stats: dict[int, dict] = {}
    for answer in answers:
        q = q_by_id.get(answer.question_id)
        if not q:
            continue
        tid = q.topic_id
        if tid not in topic_stats:
            topic_stats[tid] = {"score": 0.0, "max": 0.0, "correct": 0, "total": 0}
        topic_stats[tid]["score"] += float(answer.score_earned or 0)
        topic_stats[tid]["max"] += float(q.score_max)
        topic_stats[tid]["total"] += 1
        if answer.is_correct:
            topic_stats[tid]["correct"] += 1

    for topic_id, stats in topic_stats.items():
        mastery = stats["score"] / stats["max"] if stats["max"] > 0 else 0.0
        mastery = round(max(0.0, min(1.0, mastery)), 3)

        # Рекомендованная сложность: mastery < 0.4 → easy, 0.4–0.75 → medium, > 0.75 → hard
        if mastery < 0.4:
            difficulty = Difficulty.easy
        elif mastery < 0.75:
            difficulty = Difficulty.medium
        else:
            difficulty = Difficulty.hard

        # Upsert
        res = await db.execute(
            select(AdaptiveRecommendation).where(
                AdaptiveRecommendation.student_id == student_id,
                AdaptiveRecommendation.topic_id == topic_id,
            )
        )
        rec = res.scalar_one_or_none()
        if rec:
            # EMA: сглаживаем новое значение (α=0.4) со старым
            rec.mastery_level = round(0.6 * float(rec.mastery_level) + 0.4 * mastery, 3)
            rec.recommended_difficulty = difficulty
            rec.updated_at = datetime.utcnow()
        else:
            rec = AdaptiveRecommendation(
                student_id=student_id,
                topic_id=topic_id,
                mastery_level=mastery,
                recommended_difficulty=difficulty,
            )
            db.add(rec)

    await db.commit()


@router.get("/{session_id}/questions")
async def get_session_questions(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Вопросы для прохождения теста — без правильных ответов."""
    result = await db.execute(select(TestSession).where(TestSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")

    if current_user.role.value == "student":
        student = await _get_student(current_user, db)
        if session.student_id != student.id:
            raise HTTPException(status_code=403, detail="Доступ запрещён")

    q_ids = session.question_order or []
    if not q_ids:
        return []

    qs_result = await db.execute(select(Question).where(Question.id.in_(q_ids)))
    questions_map = {q.id: q for q in qs_result.scalars().all()}

    def strip_correct(q: Question) -> dict:
        opts = dict(q.options or {})
        # Убираем правильные ответы чтобы студент не мог их увидеть в API
        opts.pop("correct", None)
        opts.pop("correct_texts", None)
        return {
            "id": q.id,
            "question_type": q.question_type.value,
            "difficulty": q.difficulty.value,
            "body": q.body,
            "image_url": q.image_url,
            "score_max": float(q.score_max),
            "options": opts,
        }

    return [strip_correct(questions_map[qid]) for qid in q_ids if qid in questions_map]


@router.get("/{session_id}", response_model=SessionResultOut)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TestSession)
        .options(selectinload(TestSession.answers))
        .where(TestSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")

    # Студент видит только свою сессию
    if current_user.role.value == "student":
        student = await _get_student(current_user, db)
        if session.student_id != student.id:
            raise HTTPException(status_code=403, detail="Доступ запрещён")

    return session


@router.get("/student/{student_id}", response_model=list[SessionOut])
async def get_student_sessions(
    student_id: int,
    test_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.value == "student":
        student = await _get_student(current_user, db)
        if student.id != student_id:
            raise HTTPException(status_code=403, detail="Доступ запрещён")

    query = select(TestSession).where(TestSession.student_id == student_id).order_by(TestSession.started_at.desc())
    if test_id:
        query = query.where(TestSession.test_id == test_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.delete("/student/{student_id}/test/{test_id}/reset", status_code=204)
async def reset_student_test(
    student_id: int,
    test_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    """Сбросить все попытки студента по тесту — преподаватель выдаёт тест заново."""
    result = await db.execute(
        select(TestSession).where(
            TestSession.student_id == student_id,
            TestSession.test_id == test_id,
        )
    )
    sessions = result.scalars().all()
    for s in sessions:
        await db.delete(s)
    await db.commit()
