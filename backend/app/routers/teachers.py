from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.teacher import Teacher
from app.models.user import User, UserRole
from app.schemas.teacher import TeacherCreate, TeacherUpdate, TeacherOut
from app.security import hash_password
from app.dependencies import require_admin, require_teacher

router = APIRouter(prefix="/api/teachers", tags=["teachers"])


@router.get("/me", response_model=TeacherOut)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    result = await db.execute(select(Teacher).where(Teacher.user_id == current_user.id))
    teacher = result.scalar_one_or_none()
    if not teacher:
        raise HTTPException(status_code=404, detail="Профиль преподавателя не найден")
    return teacher


@router.get("", response_model=list[TeacherOut])
async def list_teachers(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Teacher).order_by(Teacher.last_name))
    return result.scalars().all()


@router.post("", response_model=TeacherOut, status_code=201)
async def create_teacher(
    data: TeacherCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")

    user = User(email=data.email, password_hash=hash_password(data.password), role=UserRole.teacher)
    db.add(user)
    await db.flush()

    teacher = Teacher(
        user_id=user.id,
        last_name=data.last_name,
        first_name=data.first_name,
        middle_name=data.middle_name,
        position=data.position,
        phone=data.phone,
    )
    db.add(teacher)
    await db.commit()
    await db.refresh(teacher)
    return teacher


@router.get("/{teacher_id}", response_model=TeacherOut)
async def get_teacher(
    teacher_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Teacher).where(Teacher.id == teacher_id))
    teacher = result.scalar_one_or_none()
    if not teacher:
        raise HTTPException(status_code=404, detail="Преподаватель не найден")
    return teacher


@router.patch("/{teacher_id}", response_model=TeacherOut)
async def update_teacher(
    teacher_id: int,
    data: TeacherUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Teacher).where(Teacher.id == teacher_id))
    teacher = result.scalar_one_or_none()
    if not teacher:
        raise HTTPException(status_code=404, detail="Преподаватель не найден")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(teacher, field, value)
    await db.commit()
    await db.refresh(teacher)
    return teacher


@router.delete("/{teacher_id}", status_code=204)
async def delete_teacher(
    teacher_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Teacher).where(Teacher.id == teacher_id))
    teacher = result.scalar_one_or_none()
    if not teacher:
        raise HTTPException(status_code=404, detail="Преподаватель не найден")
    await db.delete(teacher)
    await db.commit()
