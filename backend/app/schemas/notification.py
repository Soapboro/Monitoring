from datetime import datetime
from pydantic import BaseModel
from app.models.notification import NotifType


class NotificationOut(BaseModel):
    id: int
    user_id: int
    type: NotifType
    title: str
    body: str | None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
