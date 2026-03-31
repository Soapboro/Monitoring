from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_

from app.database import get_db
from app.models.grade import Grade, GradeType
from app.models.attendance import Attendance
from app.models.test_session import TestSession, SessionStatus
from app.models.student import Student
from app.models.group import Group
from app.models.teaching_assignment import TeachingAssignment
from app.models.subject import Subject
from app.models.user import User
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
    """Средний балл, мин/макс по группе в разрезе дисциплин."""
    query = (
        select(
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
        .group_by(Subject.name, TeachingAssignment.acad_year, TeachingAssignment.semester)
        .order_by(TeachingAssignment.acad_year, TeachingAssignment.semester, Subject.name)
    )
    if acad_year:
        query = query.where(TeachingAssignment.acad_year == acad_year)
    if semester:
        query = query.where(TeachingAssignment.semester == semester)

    result = await db.execute(query)
    rows = result.mappings().all()
    return [dict(r) for r in rows]


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
    limit: int = Query(10, le=50),
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
