from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.teaching_assignment import TeachingAssignment
from app.models.user import User
from app.schemas.teaching_assignment import TeachingAssignmentCreate, TeachingAssignmentUpdate, TeachingAssignmentOut
from app.dependencies import require_admin, require_teacher

router = APIRouter(prefix="/api/teaching-assignments", tags=["teaching-assignments"])


@router.get("", response_model=list[TeachingAssignmentOut])
async def list_assignments(
    teacher_id: int | None = None,
    group_id: int | None = None,
    subject_id: int | None = None,
    acad_year: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    query = select(TeachingAssignment)
    if teacher_id:
        query = query.where(TeachingAssignment.teacher_id == teacher_id)
    if group_id:
        query = query.where(TeachingAssignment.group_id == group_id)
    if subject_id:
        query = query.where(TeachingAssignment.subject_id == subject_id)
    if acad_year:
        query = query.where(TeachingAssignment.acad_year == acad_year)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=TeachingAssignmentOut, status_code=201)
async def create_assignment(
    data: TeachingAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    ta = TeachingAssignment(**data.model_dump())
    db.add(ta)
    await db.commit()
    await db.refresh(ta)
    return ta


@router.get("/{ta_id}", response_model=TeachingAssignmentOut)
async def get_assignment(
    ta_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(TeachingAssignment).where(TeachingAssignment.id == ta_id))
    ta = result.scalar_one_or_none()
    if not ta:
        raise HTTPException(status_code=404, detail="Назначение не найдено")
    return ta


@router.patch("/{ta_id}", response_model=TeachingAssignmentOut)
async def update_assignment(
    ta_id: int,
    data: TeachingAssignmentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(TeachingAssignment).where(TeachingAssignment.id == ta_id))
    ta = result.scalar_one_or_none()
    if not ta:
        raise HTTPException(status_code=404, detail="Назначение не найдено")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ta, field, value)
    await db.commit()
    await db.refresh(ta)
    return ta


@router.delete("/{ta_id}", status_code=204)
async def delete_assignment(
    ta_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(TeachingAssignment).where(TeachingAssignment.id == ta_id))
    ta = result.scalar_one_or_none()
    if not ta:
        raise HTTPException(status_code=404, detail="Назначение не найдено")
    await db.delete(ta)
    await db.commit()
