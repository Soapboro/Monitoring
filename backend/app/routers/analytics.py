from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_, extract, cast, Float, Numeric

from app.database import get_db
from app.models.grade import Grade, GradeType
from app.models.attendance import Attendance
from app.models.test_session import TestSession, SessionStatus
from app.models.test import Test, TestAssignment as TestAssign, TestQuestion
from app.models.question import Question
from app.models.topic import Topic
from app.models.teacher import Teacher
from app.models.student import Student
from app.models.group import Group
from app.models.teaching_assignment import TeachingAssignment
from app.models.subject import Subject
from app.models.user import User
from app.models.test_session import QuestionAnswer
from app.dependencies import require_teacher, get_current_user

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/group-summary")
async def group_summary(
    group_id: int,
    acad_year: str | None = None,
    semester: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    """Средний балл, мин/макс по группе в разрезе дисциплин + статистика тестов."""
    query = (
        select(
            Subject.id.label("subject_id"),
            Subject.name.label("subject"),
            TeachingAssignment.acad_year,
            TeachingAssignment.semester,
            func.count(func.distinct(Grade.student_id)).label("students_count"),
            func.round(func.avg(Grade.value), 2).label("avg_grade"),
            func.min(Grade.value).label("min_grade"),
            func.max(Grade.value).label("max_grade"),
        )
        .join(TeachingAssignment, Grade.assignment_id == TeachingAssignment.id)
        .join(Subject, TeachingAssignment.subject_id == Subject.id)
        .where(
            TeachingAssignment.group_id == group_id,
            Grade.value.isnot(None),
        )
        .group_by(Subject.id, Subject.name, TeachingAssignment.acad_year, TeachingAssignment.semester)
        .order_by(TeachingAssignment.acad_year, TeachingAssignment.semester, Subject.name)
    )
    if acad_year:
        query = query.where(TeachingAssignment.acad_year == acad_year)
    if semester:
        query = query.where(TeachingAssignment.semester == semester)

    result = await db.execute(query)
    rows = result.mappings().all()

    # Размер группы (все студенты) — знаменатель "выдано"
    group_size_q = select(func.count(Student.id)).where(Student.group_id == group_id)
    group_size = (await db.execute(group_size_q)).scalar() or 0

    # Предметы, по которым вообще есть выданные тесты для группы
    has_tests_q = (
        select(func.distinct(Test.subject_id))
        .select_from(TestAssign)
        .join(Test, TestAssign.test_id == Test.id)
        .where(TestAssign.group_id == group_id)
    )
    subjects_with_tests = {
        r[0] for r in (await db.execute(has_tests_q)).all()
    }

    # Количество уникальных студентов, сдавших хотя бы один тест по предмету
    passed_q = (
        select(
            Test.subject_id,
            func.count(func.distinct(TestSession.student_id)).label("tests_passed"),
        )
        .join(Test, TestSession.test_id == Test.id)
        .join(Student, TestSession.student_id == Student.id)
        .where(
            Student.group_id == group_id,
            TestSession.status == SessionStatus.completed,
            TestSession.passed == True,
        )
        .group_by(Test.subject_id)
    )
    passed_map = {
        r["subject_id"]: r["tests_passed"]
        for r in (await db.execute(passed_q)).mappings().all()
    }

    out = []
    for r in rows:
        row = dict(r)
        sid = row.pop("subject_id")
        # tests_total: размер группы (если по предмету есть тесты), иначе 0
        row["tests_total"] = group_size if sid in subjects_with_tests else 0
        row["tests_passed"] = passed_map.get(sid, 0)
        out.append(row)
    return out


@router.get("/student-progress/{student_id}")
async def student_progress(
    student_id: int,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Динамика оценок студента по времени."""
    if current_user.role.value == "student":
        result = await db.execute(select(Student).where(Student.user_id == current_user.id))
        st = result.scalar_one_or_none()
        if not st or st.id != student_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Доступ запрещён")

    query = (
        select(
            Grade.date_recorded,
            Subject.name.label("subject"),
            Grade.grade_type,
            Grade.value,
            Grade.passed,
        )
        .join(TeachingAssignment, Grade.assignment_id == TeachingAssignment.id)
        .join(Subject, TeachingAssignment.subject_id == Subject.id)
        .where(Grade.student_id == student_id, Grade.value.isnot(None))
        .order_by(Grade.date_recorded)
    )
    if date_from:
        query = query.where(Grade.date_recorded >= date_from)
    if date_to:
        query = query.where(Grade.date_recorded <= date_to)

    result = await db.execute(query)
    rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.get("/student-subjects/{student_id}")
async def student_subjects_summary(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Средний балл студента по каждой дисциплине."""
    query = (
        select(
            Subject.name.label("subject"),
            func.round(func.avg(Grade.value), 2).label("avg_grade"),
            func.count(Grade.id).label("grades_count"),
            func.min(Grade.value).label("min_grade"),
            func.max(Grade.value).label("max_grade"),
        )
        .join(TeachingAssignment, Grade.assignment_id == TeachingAssignment.id)
        .join(Subject, TeachingAssignment.subject_id == Subject.id)
        .where(Grade.student_id == student_id, Grade.value.isnot(None))
        .group_by(Subject.name)
        .order_by(Subject.name)
    )
    result = await db.execute(query)
    rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.get("/attendance-rate")
async def attendance_rate(
    group_id: int | None = None,
    student_id: int | None = None,
    assignment_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    """Процент посещаемости."""
    query = (
        select(
            func.count(Attendance.id).label("total"),
            func.sum(case((Attendance.is_present == True, 1), else_=0)).label("present"),
        )
        .join(TeachingAssignment, Attendance.assignment_id == TeachingAssignment.id)
    )
    if group_id:
        query = query.where(TeachingAssignment.group_id == group_id)
    if student_id:
        query = query.where(Attendance.student_id == student_id)
    if assignment_id:
        query = query.where(Attendance.assignment_id == assignment_id)

    result = await db.execute(query)
    row = result.mappings().one()
    total = row["total"] or 0
    present = int(row["present"] or 0)
    rate = round(present / total * 100, 1) if total > 0 else None
    return {"total": total, "present": present, "absent": total - present, "rate_pct": rate}


@router.get("/test-stats/{test_id}")
async def test_statistics(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    """Статистика по тесту: попытки, средний процент, количество сдавших."""
    query = (
        select(
            func.count(TestSession.id).label("attempts"),
            func.count(func.distinct(TestSession.student_id)).label("students"),
            func.round(
                func.avg(
                    case(
                        (TestSession.score_max > 0,
                         TestSession.score_total / TestSession.score_max * 100),
                        else_=None
                    )
                ), 1
            ).label("avg_pct"),
            func.sum(case((TestSession.passed == True, 1), else_=0)).label("passed_count"),
        )
        .where(
            TestSession.test_id == test_id,
            TestSession.status == SessionStatus.completed,
        )
    )
    result = await db.execute(query)
    row = result.mappings().one()
    return dict(row)


@router.get("/group-attendance-by-subject")
async def group_attendance_by_subject(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    """Посещаемость по группе в разрезе дисциплин."""
    query = (
        select(
            Subject.name.label("subject"),
            func.count(Attendance.id).label("total"),
            func.sum(case((Attendance.is_present == True, 1), else_=0)).label("present"),
        )
        .join(TeachingAssignment, Attendance.assignment_id == TeachingAssignment.id)
        .join(Subject, TeachingAssignment.subject_id == Subject.id)
        .where(TeachingAssignment.group_id == group_id)
        .group_by(Subject.name)
        .order_by(Subject.name)
    )
    result = await db.execute(query)
    rows = result.mappings().all()
    out = []
    for r in rows:
        total = r["total"] or 0
        present = int(r["present"] or 0)
        rate = round(present / total * 100, 1) if total > 0 else None
        out.append({"subject": r["subject"], "total": total, "present": present, "rate_pct": rate})
    return out


@router.get("/top-students")
async def top_students(
    group_id: int | None = None,
    subject_id: int | None = None,
    limit: int = Query(10, le=5000),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    """Рейтинг студентов по среднему баллу."""
    query = (
        select(
            Student.id,
            (Student.last_name + " " + Student.first_name).label("name"),
            Group.name.label("group"),
            func.round(func.avg(Grade.value), 2).label("avg_grade"),
        )
        .join(Grade, Grade.student_id == Student.id)
        .join(Group, Student.group_id == Group.id)
        .join(TeachingAssignment, Grade.assignment_id == TeachingAssignment.id)
        .where(Grade.value.isnot(None))
        .group_by(Student.id, Student.last_name, Student.first_name, Group.name)
        .order_by(func.avg(Grade.value).desc())
        .limit(limit)
    )
    if group_id:
        query = query.where(Student.group_id == group_id)
    if subject_id:
        query = query.where(TeachingAssignment.subject_id == subject_id)

    result = await db.execute(query)
    rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.get("/rating/groups")
async def rating_by_groups(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    """Рейтинг групп по среднему баллу."""
    query = (
        select(
            Group.id,
            Group.name.label("group"),
            func.round(func.avg(Grade.value), 2).label("avg_grade"),
            func.count(func.distinct(Grade.student_id)).label("students_count"),
            func.count(Grade.id).label("grades_count"),
        )
        .join(TeachingAssignment, Grade.assignment_id == TeachingAssignment.id)
        .join(Group, TeachingAssignment.group_id == Group.id)
        .where(Grade.value.isnot(None))
        .group_by(Group.id, Group.name)
        .order_by(func.avg(Grade.value).desc())
    )
    result = await db.execute(query)
    rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.get("/rating/subjects")
async def rating_by_subjects(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    """Рейтинг предметов по среднему баллу."""
    query = (
        select(
            Subject.id,
            Subject.name.label("subject"),
            func.round(func.avg(Grade.value), 2).label("avg_grade"),
            func.count(func.distinct(Grade.student_id)).label("students_count"),
            func.count(Grade.id).label("grades_count"),
        )
        .join(TeachingAssignment, Grade.assignment_id == TeachingAssignment.id)
        .join(Subject, TeachingAssignment.subject_id == Subject.id)
        .where(Grade.value.isnot(None))
        .group_by(Subject.id, Subject.name)
        .order_by(func.avg(Grade.value).desc())
    )
    result = await db.execute(query)
    rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.get("/question-stats")
async def question_stats(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    """Статистика по вопросам теста: частота ошибок, среднее время."""
    query = (
        select(
            TestQuestion.id.label("test_question_id"),
            TestQuestion.order_num.label("order_index"),
            Question.id.label("question_id"),
            Question.body.label("question_text"),
            Question.question_type,
            Topic.title.label("topic"),
            func.count(QuestionAnswer.id).label("attempts"),
            func.sum(case((QuestionAnswer.is_correct == True, 1), else_=0)).label("correct_count"),
            func.round(
                cast(
                    func.sum(case((QuestionAnswer.is_correct == False, 1), else_=0)), Numeric
                ) / func.nullif(func.count(QuestionAnswer.id), 0) * 100,
                1
            ).label("error_rate_pct"),
            func.round(func.avg(QuestionAnswer.time_spent_sec), 1).label("avg_time_sec"),
        )
        .join(TestSession, QuestionAnswer.session_id == TestSession.id)
        .join(Question, QuestionAnswer.question_id == Question.id)
        .join(TestQuestion, and_(
            TestQuestion.question_id == Question.id,
            TestQuestion.test_id == test_id,
        ))
        .outerjoin(Topic, Question.topic_id == Topic.id)
        .where(
            TestQuestion.test_id == test_id,
            TestSession.status == SessionStatus.completed,
        )
        .group_by(
            TestQuestion.id, TestQuestion.order_num,
            Question.id, Question.body, Question.question_type,
            Topic.title,
        )
        .order_by(TestQuestion.order_num)
    )
    result = await db.execute(query)
    rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.get("/test-durations")
async def test_durations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    """Среднее/мин/макс время прохождения тестов преподавателя."""
    teacher_q = select(Teacher.id).where(Teacher.user_id == current_user.id)
    teacher_id = (await db.execute(teacher_q)).scalar_one_or_none()
    if teacher_id is None:
        return []

    query = (
        select(
            Test.id.label("test_id"),
            Test.title,
            Subject.name.label("subject"),
            func.count(TestSession.id).label("attempts"),
            func.round(func.avg(
                extract("epoch", TestSession.finished_at) - extract("epoch", TestSession.started_at)
            ), 0).label("avg_duration_sec"),
            func.min(
                extract("epoch", TestSession.finished_at) - extract("epoch", TestSession.started_at)
            ).label("min_duration_sec"),
            func.max(
                extract("epoch", TestSession.finished_at) - extract("epoch", TestSession.started_at)
            ).label("max_duration_sec"),
        )
        .join(TestSession, TestSession.test_id == Test.id)
        .join(Subject, Test.subject_id == Subject.id)
        .where(
            Test.author_id == teacher_id,
            TestSession.status == SessionStatus.completed,
            TestSession.finished_at.isnot(None),
            TestSession.started_at.isnot(None),
        )
        .group_by(Test.id, Test.title, Subject.name)
        .order_by(func.avg(
            extract("epoch", TestSession.finished_at) - extract("epoch", TestSession.started_at)
        ).desc())
    )
    result = await db.execute(query)
    rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.get("/topic-mastery")
async def topic_mastery(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    """Освоенность тем группой: процент правильных ответов по каждой теме."""
    query = (
        select(
            Topic.id.label("topic_id"),
            Topic.title.label("topic"),
            func.count(QuestionAnswer.id).label("attempts"),
            func.sum(case((QuestionAnswer.is_correct == True, 1), else_=0)).label("correct_count"),
            func.round(
                cast(
                    func.sum(case((QuestionAnswer.is_correct == True, 1), else_=0)), Numeric
                ) / func.nullif(func.count(QuestionAnswer.id), 0) * 100,
                1
            ).label("correct_pct"),
        )
        .join(TestSession, QuestionAnswer.session_id == TestSession.id)
        .join(Student, TestSession.student_id == Student.id)
        .join(Question, QuestionAnswer.question_id == Question.id)
        .join(Topic, Question.topic_id == Topic.id)
        .where(
            Student.group_id == group_id,
            TestSession.status == SessionStatus.completed,
        )
        .group_by(Topic.id, Topic.title)
        .order_by(func.round(
            cast(func.sum(case((QuestionAnswer.is_correct == True, 1), else_=0)), Numeric)
            / func.nullif(func.count(QuestionAnswer.id), 0) * 100, 1
        ))
    )
    result = await db.execute(query)
    rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.get("/student-dynamics/{student_id}")
async def student_dynamics(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Динамика успеваемости студента по семестрам с трендом."""
    if current_user.role.value == "student":
        res = await db.execute(select(Student).where(Student.user_id == current_user.id))
        st = res.scalar_one_or_none()
        if not st or st.id != student_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Доступ запрещён")

    period_q = (
        select(
            TeachingAssignment.acad_year,
            TeachingAssignment.semester,
            func.round(func.avg(Grade.value), 2).label("avg_grade"),
            func.min(Grade.value).label("min_grade"),
            func.max(Grade.value).label("max_grade"),
            func.count(Grade.id).label("grades_count"),
        )
        .join(TeachingAssignment, Grade.assignment_id == TeachingAssignment.id)
        .where(Grade.student_id == student_id, Grade.value.isnot(None))
        .group_by(TeachingAssignment.acad_year, TeachingAssignment.semester)
        .order_by(TeachingAssignment.acad_year, TeachingAssignment.semester)
    )
    periods = [dict(r) for r in (await db.execute(period_q)).mappings().all()]
    for i, p in enumerate(periods):
        p["trend"] = None if i == 0 else round(
            float(p["avg_grade"] or 0) - float(periods[i - 1]["avg_grade"] or 0), 2
        )

    subject_q = (
        select(
            TeachingAssignment.acad_year,
            TeachingAssignment.semester,
            Subject.name.label("subject"),
            func.round(func.avg(Grade.value), 2).label("avg_grade"),
            func.count(Grade.id).label("grades_count"),
        )
        .join(TeachingAssignment, Grade.assignment_id == TeachingAssignment.id)
        .join(Subject, TeachingAssignment.subject_id == Subject.id)
        .where(Grade.student_id == student_id, Grade.value.isnot(None))
        .group_by(TeachingAssignment.acad_year, TeachingAssignment.semester, Subject.name)
        .order_by(TeachingAssignment.acad_year, TeachingAssignment.semester, Subject.name)
    )
    by_subject = [dict(r) for r in (await db.execute(subject_q)).mappings().all()]
    return {"periods": periods, "by_subject": by_subject}


@router.get("/group-dynamics")
async def group_dynamics(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    """Динамика успеваемости группы по семестрам (все типы оценок) с трендом."""
    period_q = (
        select(
            TeachingAssignment.acad_year,
            TeachingAssignment.semester,
            func.round(func.avg(Grade.value), 2).label("avg_grade"),
            func.min(Grade.value).label("min_grade"),
            func.max(Grade.value).label("max_grade"),
            func.count(func.distinct(Grade.student_id)).label("students_count"),
            func.count(Grade.id).label("grades_count"),
        )
        .join(TeachingAssignment, Grade.assignment_id == TeachingAssignment.id)
        .where(TeachingAssignment.group_id == group_id, Grade.value.isnot(None))
        .group_by(TeachingAssignment.acad_year, TeachingAssignment.semester)
        .order_by(TeachingAssignment.acad_year, TeachingAssignment.semester)
    )
    periods = [dict(r) for r in (await db.execute(period_q)).mappings().all()]
    for i, p in enumerate(periods):
        p["trend"] = None if i == 0 else round(
            float(p["avg_grade"] or 0) - float(periods[i - 1]["avg_grade"] or 0), 2
        )

    subject_q = (
        select(
            TeachingAssignment.acad_year,
            TeachingAssignment.semester,
            Subject.name.label("subject"),
            func.round(func.avg(Grade.value), 2).label("avg_grade"),
            func.count(func.distinct(Grade.student_id)).label("students_count"),
        )
        .join(TeachingAssignment, Grade.assignment_id == TeachingAssignment.id)
        .join(Subject, TeachingAssignment.subject_id == Subject.id)
        .where(TeachingAssignment.group_id == group_id, Grade.value.isnot(None))
        .group_by(TeachingAssignment.acad_year, TeachingAssignment.semester, Subject.name)
        .order_by(TeachingAssignment.acad_year, TeachingAssignment.semester, Subject.name)
    )
    by_subject = [dict(r) for r in (await db.execute(subject_q)).mappings().all()]
    return {"periods": periods, "by_subject": by_subject}


@router.get("/student-weaknesses")
async def student_weaknesses(
    group_id: int,
    min_attempts: int = Query(2, ge=1),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    """По каждому студенту группы — проблемные темы (низкий % правильных ответов)."""
    query = (
        select(
            Student.id.label("student_id"),
            (Student.last_name + " " + Student.first_name).label("student_name"),
            Topic.id.label("topic_id"),
            Topic.title.label("topic"),
            func.count(QuestionAnswer.id).label("attempts"),
            func.sum(case((QuestionAnswer.is_correct == True, 1), else_=0)).label("correct_count"),
            func.round(
                cast(
                    func.sum(case((QuestionAnswer.is_correct == True, 1), else_=0)), Numeric
                ) / func.nullif(func.count(QuestionAnswer.id), 0) * 100,
                1
            ).label("correct_pct"),
        )
        .join(TestSession, QuestionAnswer.session_id == TestSession.id)
        .join(Student, TestSession.student_id == Student.id)
        .join(Question, QuestionAnswer.question_id == Question.id)
        .join(Topic, Question.topic_id == Topic.id)
        .where(
            Student.group_id == group_id,
            TestSession.status == SessionStatus.completed,
        )
        .group_by(Student.id, Student.last_name, Student.first_name, Topic.id, Topic.title)
        .having(func.count(QuestionAnswer.id) >= min_attempts)
        .order_by(Student.last_name, Student.first_name)
    )
    result = await db.execute(query)
    rows = result.mappings().all()
    return [dict(r) for r in rows]
