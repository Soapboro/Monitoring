from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.grade import Grade
from app.models.teacher import Teacher
from app.models.user import User
from app.schemas.grade import GradeCreate, GradeUpdate, GradeOut
from app.dependencies import require_teacher, get_current_user

router = APIRouter(prefix="/api/grades", tags=["grades"])


async def _teacher_id(current_user: User, db: AsyncSession) -> int:
    result = await db.execute(select(Teacher).where(Teacher.user_id == current_user.id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=403, detail="Профиль преподавателя не найден")
    return t.id


@router.get("", response_model=list[GradeOut])
async def list_grades(
    student_id: int | None = None,
    assignment_id: int | None = None,
    grade_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    query = select(Grade).order_by(Grade.date_recorded.desc())
    if student_id:
        query = query.where(Grade.student_id == student_id)
    if assignment_id:
        query = query.where(Grade.assignment_id == assignment_id)
    if grade_type:
        query = query.where(Grade.grade_type == grade_type)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=GradeOut, status_code=201)
async def create_grade(
    data: GradeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    teacher_id = await _teacher_id(current_user, db)
    grade = Grade(
        **data.model_dump(exclude_none=True),
        recorded_by=teacher_id,
        date_recorded=data.date_recorded or date.today(),
    )
    db.add(grade)
    await db.commit()
    await db.refresh(grade)
    return grade


@router.get("/{grade_id}", response_model=GradeOut)
async def get_grade(
    grade_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Grade).where(Grade.id == grade_id))
    grade = result.scalar_one_or_none()
    if not grade:
        raise HTTPException(status_code=404, detail="Оценка не найдена")
    return grade


@router.patch("/{grade_id}", response_model=GradeOut)
async def update_grade(
    grade_id: int,
    data: GradeUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Grade).where(Grade.id == grade_id))
    grade = result.scalar_one_or_none()
    if not grade:
        raise HTTPException(status_code=404, detail="Оценка не найдена")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(grade, field, value)
    await db.commit()
    await db.refresh(grade)
    return grade


@router.delete("/{grade_id}", status_code=204)
async def delete_grade(
    grade_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Grade).where(Grade.id == grade_id))
    grade = result.scalar_one_or_none()
    if not grade:
        raise HTTPException(status_code=404, detail="Оценка не найдена")
    await db.delete(grade)
    await db.commit()
