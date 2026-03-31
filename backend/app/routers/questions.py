from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.question import Question
from app.models.teacher import Teacher
from app.models.user import User
from app.schemas.question import QuestionCreate, QuestionUpdate, QuestionOut
from app.dependencies import require_teacher

router = APIRouter(prefix="/api/questions", tags=["questions"])


async def _get_teacher_id(current_user: User, db: AsyncSession) -> int | None:
    if current_user.role.value == "teacher":
        result = await db.execute(select(Teacher).where(Teacher.user_id == current_user.id))
        teacher = result.scalar_one_or_none()
        return teacher.id if teacher else None
    return None


@router.get("", response_model=list[QuestionOut])
async def list_questions(
    topic_id: int | None = None,
    difficulty: str | None = None,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    query = select(Question)
    if topic_id:
        query = query.where(Question.topic_id == topic_id)
    if difficulty:
        query = query.where(Question.difficulty == difficulty)
    if is_active is not None:
        query = query.where(Question.is_active == is_active)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=QuestionOut, status_code=201)
async def create_question(
    data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    author_id = await _get_teacher_id(current_user, db)
    question = Question(**data.model_dump(), author_id=author_id)
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return question


@router.get("/{question_id}", response_model=QuestionOut)
async def get_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Вопрос не найден")
    return q


@router.patch("/{question_id}", response_model=QuestionOut)
async def update_question(
    question_id: int,
    data: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Вопрос не найден")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(q, field, value)
    await db.commit()
    await db.refresh(q)
    return q


@router.delete("/{question_id}", status_code=204)
async def delete_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Вопрос не найден")
    await db.delete(q)
    await db.commit()
