from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.department import Department
from app.models.user import User
from app.schemas.department import DepartmentCreate, DepartmentUpdate, DepartmentOut
from app.dependencies import require_admin, require_teacher

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentOut])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Department).order_by(Department.name))
    return result.scalars().all()


@router.post("", response_model=DepartmentOut, status_code=201)
async def create_department(
    data: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    dept = Department(**data.model_dump())
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return dept


@router.get("/{dept_id}", response_model=DepartmentOut)
async def get_department(
    dept_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Кафедра не найдена")
    return dept


@router.patch("/{dept_id}", response_model=DepartmentOut)
async def update_department(
    dept_id: int,
    data: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Кафедра не найдена")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(dept, field, value)
    await db.commit()
    await db.refresh(dept)
    return dept


@router.delete("/{dept_id}", status_code=204)
async def delete_department(
    dept_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Кафедра не найдена")
    await db.delete(dept)
    await db.commit()
