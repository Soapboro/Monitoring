from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.group import Group
from app.models.user import User
from app.schemas.group import GroupCreate, GroupUpdate, GroupOut
from app.dependencies import require_admin, require_teacher

router = APIRouter(prefix="/api/groups", tags=["groups"])


@router.get("", response_model=list[GroupOut])
async def list_groups(
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    query = select(Group).order_by(Group.name)
    if is_active is not None:
        query = query.where(Group.is_active == is_active)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=GroupOut, status_code=201)
async def create_group(
    data: GroupCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    group = Group(**data.model_dump())
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


@router.get("/{group_id}", response_model=GroupOut)
async def get_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    return group


@router.patch("/{group_id}", response_model=GroupOut)
async def update_group(
    group_id: int,
    data: GroupUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(group, field, value)
    await db.commit()
    await db.refresh(group)
    return group


@router.delete("/{group_id}", status_code=204)
async def delete_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    await db.delete(group)
    await db.commit()
