from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.attendance import Attendance
from app.models.teacher import Teacher
from app.models.user import User
from app.schemas.attendance import AttendanceCreate, AttendanceBulkCreate, AttendanceUpdate, AttendanceOut
from app.dependencies import require_teacher

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


async def _teacher_id(current_user: User, db: AsyncSession) -> int:
    result = await db.execute(select(Teacher).where(Teacher.user_id == current_user.id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=403, detail="Профиль преподавателя не найден")
    return t.id


@router.get("", response_model=list[AttendanceOut])
async def list_attendance(
    student_id: int | None = None,
    assignment_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    query = select(Attendance).order_by(Attendance.lesson_date.desc())
    if student_id:
        query = query.where(Attendance.student_id == student_id)
    if assignment_id:
        query = query.where(Attendance.assignment_id == assignment_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=AttendanceOut, status_code=201)
async def create_attendance(
    data: AttendanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    teacher_id = await _teacher_id(current_user, db)
    rec = Attendance(**data.model_dump(), recorded_by=teacher_id)
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return rec


@router.post("/bulk", response_model=list[AttendanceOut], status_code=201)
async def bulk_attendance(
    data: AttendanceBulkCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    teacher_id = await _teacher_id(current_user, db)
    records = []
    for rec in data.records:
        a = Attendance(
            student_id=rec.student_id,
            assignment_id=data.assignment_id,
            lesson_date=data.lesson_date,
            is_present=rec.is_present,
            comment=rec.comment,
            recorded_by=teacher_id,
        )
        db.add(a)
        records.append(a)
    await db.commit()
    for r in records:
        await db.refresh(r)
    return records


@router.patch("/{att_id}", response_model=AttendanceOut)
async def update_attendance(
    att_id: int,
    data: AttendanceUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Attendance).where(Attendance.id == att_id))
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(att, field, value)
    await db.commit()
    await db.refresh(att)
    return att


@router.delete("/{att_id}", status_code=204)
async def delete_attendance(
    att_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Attendance).where(Attendance.id == att_id))
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    await db.delete(att)
    await db.commit()
