from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.lesson import Lesson
from app.models.teacher import Teacher
from app.models.teaching_assignment import TeachingAssignment
from app.models.user import User
from app.schemas.lesson import LessonCreate, LessonUpdate, LessonOut
from app.dependencies import require_teacher, require_admin

router = APIRouter(prefix="/api/lessons", tags=["lessons"])


async def _teacher_id(current_user: User, db: AsyncSession) -> int:
    result = await db.execute(select(Teacher).where(Teacher.user_id == current_user.id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=403, detail="Профиль преподавателя не найден")
    return t.id


@router.get("", response_model=list[LessonOut])
async def list_lessons(
    teacher_id: int | None = None,
    assignment_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    query = select(Lesson).order_by(Lesson.starts_at)

    if assignment_id:
        query = query.where(Lesson.assignment_id == assignment_id)
    elif teacher_id:
        # фильтр через join на teaching_assignments
        query = query.join(TeachingAssignment).where(TeachingAssignment.teacher_id == teacher_id)
    else:
        # преподаватель видит только свои занятия
        if current_user.role.value == "teacher":
            tid = await _teacher_id(current_user, db)
            query = query.join(TeachingAssignment).where(TeachingAssignment.teacher_id == tid)

    if date_from:
        query = query.where(Lesson.starts_at >= date_from)
    if date_to:
        query = query.where(Lesson.starts_at <= date_to)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=LessonOut, status_code=201)
async def create_lesson(
    data: LessonCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    # проверяем что assignment принадлежит этому преподавателю (или admin)
    if current_user.role.value == "teacher":
        tid = await _teacher_id(current_user, db)
        result = await db.execute(
            select(TeachingAssignment).where(
                TeachingAssignment.id == data.assignment_id,
                TeachingAssignment.teacher_id == tid,
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Нет доступа к этому назначению")

    lesson = Lesson(**data.model_dump())
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)
    return lesson


@router.get("/{lesson_id}", response_model=LessonOut)
async def get_lesson(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Занятие не найдено")
    return lesson


@router.patch("/{lesson_id}", response_model=LessonOut)
async def update_lesson(
    lesson_id: int,
    data: LessonUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Занятие не найдено")

    if current_user.role.value == "teacher":
        tid = await _teacher_id(current_user, db)
        assign = await db.execute(
            select(TeachingAssignment).where(
                TeachingAssignment.id == lesson.assignment_id,
                TeachingAssignment.teacher_id == tid,
            )
        )
        if not assign.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Нет доступа")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lesson, field, value)
    await db.commit()
    await db.refresh(lesson)
    return lesson


@router.delete("/{lesson_id}", status_code=204)
async def delete_lesson(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Занятие не найдено")

    if current_user.role.value == "teacher":
        tid = await _teacher_id(current_user, db)
        assign = await db.execute(
            select(TeachingAssignment).where(
                TeachingAssignment.id == lesson.assignment_id,
                TeachingAssignment.teacher_id == tid,
            )
        )
        if not assign.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Нет доступа")

    await db.delete(lesson)
    await db.commit()
