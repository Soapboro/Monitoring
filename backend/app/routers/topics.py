from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.topic import Topic
from app.models.user import User
from app.schemas.topic import TopicCreate, TopicUpdate, TopicOut
from app.dependencies import require_admin, require_teacher

router = APIRouter(prefix="/api/topics", tags=["topics"])


@router.get("", response_model=list[TopicOut])
async def list_topics(
    subject_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    query = select(Topic).order_by(Topic.subject_id, Topic.order_num)
    if subject_id:
        query = query.where(Topic.subject_id == subject_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=TopicOut, status_code=201)
async def create_topic(
    data: TopicCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    topic = Topic(**data.model_dump())
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.get("/{topic_id}", response_model=TopicOut)
async def get_topic(
    topic_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    return topic


@router.patch("/{topic_id}", response_model=TopicOut)
async def update_topic(
    topic_id: int,
    data: TopicUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(topic, field, value)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.delete("/{topic_id}", status_code=204)
async def delete_topic(
    topic_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    await db.delete(topic)
    await db.commit()
