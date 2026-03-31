from pydantic import BaseModel


class TopicCreate(BaseModel):
    subject_id: int
    title: str
    order_num: int = 1
    parent_id: int | None = None


class TopicUpdate(BaseModel):
    title: str | None = None
    order_num: int | None = None
    parent_id: int | None = None


class TopicOut(BaseModel):
    id: int
    subject_id: int
    title: str
    order_num: int
    parent_id: int | None

    model_config = {"from_attributes": True}
