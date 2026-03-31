from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.student import Student
from app.models.grade import Grade
from app.models.attendance import Attendance
from app.models.test_session import TestSession
from app.models.adaptive import AdaptiveRecommendation
from app.models.teaching_assignment import TeachingAssignment
from app.models.topic import Topic
from app.models.subject import Subject
from app.models.user import User, UserRole
from app.schemas.student import StudentCreate, StudentUpdate, StudentOut
from app.schemas.grade import GradeOut
from app.schemas.attendance import AttendanceOut
from app.schemas.test_session import SessionOut
from app.security import hash_password
from app.dependencies import require_admin, require_teacher, get_current_user

router = APIRouter(prefix="/api/students", tags=["students"])


@router.get("", response_model=list[StudentOut])
async def list_students(
    group_id: int | None = None,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    query = select(Student).order_by(Student.last_name, Student.first_name)
    if group_id is not None:
        query = query.where(Student.group_id == group_id)
    if is_active is not None:
        query = query.where(Student.is_active == is_active)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=StudentOut, status_code=201)
async def create_student(
    data: StudentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    user_id = None
    if data.email and data.password:
        existing = await db.execute(select(User).where(User.email == data.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
        user = User(email=data.email, password_hash=hash_password(data.password), role=UserRole.student)
        db.add(user)
        await db.flush()
        user_id = user.id

    student = Student(
        user_id=user_id,
        last_name=data.last_name,
        first_name=data.first_name,
        middle_name=data.middle_name,
        birth_date=data.birth_date,
        group_id=data.group_id,
        student_num=data.student_num,
        phone=data.phone,
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)
    return student


@router.get("/{student_id}", response_model=StudentOut)
async def get_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Студент не найден")
    return student


@router.patch("/{student_id}", response_model=StudentOut)
async def update_student(
    student_id: int,
    data: StudentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Студент не найден")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(student, field, value)
    await db.commit()
    await db.refresh(student)
    return student


@router.delete("/{student_id}", status_code=204)
async def delete_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Студент не найден")
    await db.delete(student)
    await db.commit()


# --- Личный кабинет студента ---

async def _get_me(current_user: User, db: AsyncSession) -> Student:
    result = await db.execute(select(Student).where(Student.user_id == current_user.id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Профиль студента не найден")
    return student


@router.get("/me/profile", response_model=StudentOut, tags=["student-cabinet"])
async def my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Профиль текущего студента."""
    return await _get_me(current_user, db)


@router.get("/me/grades", response_model=list[GradeOut], tags=["student-cabinet"])
async def my_grades(
    subject_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Оценки текущего студента."""
    student = await _get_me(current_user, db)
    query = (
        select(Grade)
        .join(TeachingAssignment, Grade.assignment_id == TeachingAssignment.id)
        .where(Grade.student_id == student.id)
        .order_by(Grade.date_recorded.desc())
    )
    if subject_id:
        query = query.where(TeachingAssignment.subject_id == subject_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/me/attendance", response_model=list[AttendanceOut], tags=["student-cabinet"])
async def my_attendance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Посещаемость текущего студента."""
    student = await _get_me(current_user, db)
    result = await db.execute(
        select(Attendance)
        .where(Attendance.student_id == student.id)
        .order_by(Attendance.lesson_date.desc())
    )
    return result.scalars().all()


@router.get("/me/sessions", response_model=list[SessionOut], tags=["student-cabinet"])
async def my_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Сессии тестирования текущего студента."""
    student = await _get_me(current_user, db)
    result = await db.execute(
        select(TestSession)
        .where(TestSession.student_id == student.id)
        .order_by(TestSession.started_at.desc())
    )
    return result.scalars().all()


@router.get("/me/adaptive", tags=["student-cabinet"])
async def my_adaptive(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Адаптивные рекомендации текущего студента по темам."""
    student = await _get_me(current_user, db)
    result = await db.execute(
        select(
            AdaptiveRecommendation.topic_id,
            Topic.title.label("topic"),
            Subject.name.label("subject"),
            AdaptiveRecommendation.mastery_level,
            AdaptiveRecommendation.recommended_difficulty,
            AdaptiveRecommendation.updated_at,
        )
        .join(Topic, AdaptiveRecommendation.topic_id == Topic.id)
        .join(Subject, Topic.subject_id == Subject.id)
        .where(AdaptiveRecommendation.student_id == student.id)
        .order_by(AdaptiveRecommendation.mastery_level)
    )
    rows = result.mappings().all()
    return [dict(r) for r in rows]
