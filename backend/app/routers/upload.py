import uuid
import os
from fastapi import APIRouter, UploadFile, HTTPException, Depends
from app.models.user import User
from app.dependencies import require_teacher

MEDIA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "media")
os.makedirs(MEDIA_DIR, exist_ok=True)

ALLOWED = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB

router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("")
async def upload_image(
    file: UploadFile,
    _: User = Depends(require_teacher),
):
    if file.content_type not in ALLOWED:
        raise HTTPException(400, f"Неподдерживаемый тип: {file.content_type}")
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "Файл слишком большой (максимум 5 МБ)")
    ext = os.path.splitext(file.filename or "img")[1].lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(MEDIA_DIR, filename), "wb") as f:
        f.write(content)
    return {"url": f"/media/{filename}"}
