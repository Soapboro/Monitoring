import asyncio
from app.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.security import hash_password

async def create_admin():
    async with AsyncSessionLocal() as db:
        user = User(email='admin@test.ru', password_hash=hash_password('admin1234'), role=UserRole.admin)
        db.add(user)
        await db.commit()
        print('Admin создан: admin@test.ru / admin1234')

asyncio.run(create_admin())