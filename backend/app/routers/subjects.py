from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.subject import Subject
from app.models.user import User
from app.schemas.subject import SubjectCreate, SubjectUpdate, SubjectOut
from app.dependencies import require_admin, require_teacher

router = APIRouter(prefix="/api/subjects", tags=["subjects"])


@router.get("", response_model=list[SubjectOut])
async def list_subjects(
    department_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    query = select(Subject).order_by(Subject.name)
    if department_id is not None:
        query = query.where(Subject.department_id == department_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=SubjectOut, status_code=201)
async def create_subject(
    data: SubjectCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    subject = Subject(**data.model_dump())
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return subject


@router.get("/{subject_id}", response_model=SubjectOut)
async def get_subject(
    subject_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Дисциплина не найдена")
    return subject


@router.patch("/{subject_id}", response_model=SubjectOut)
async def update_subject(
    subject_id: int,
    data: SubjectUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Дисциплина не найдена")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(subject, field, value)
    await db.commit()
    await db.refresh(subject)
    return subject


@router.delete("/{subject_id}", status_code=204)
async def delete_subject(
    subject_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Дисциплина не найдена")
    await db.delete(subject)
    await db.commit()
