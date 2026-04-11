"""
Пересоздаёт хэши паролей для всех пользователей.
Пароли берутся из словаря ниже — проверь и при необходимости измени.
Запуск: python reset-passwords.py
"""
import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.user import User
from app.security import hash_password

# email -> пароль
PASSWORDS = {
    'admin@test.ru': 'admin1234',
    'teacher@test.ru': 'teacher1234',
    'student@test.ru': 'student1234',
}

async def reset():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email.in_(list(PASSWORDS.keys()))))
        users = result.scalars().all()
        for u in users:
            pwd = PASSWORDS[u.email]
            u.password_hash = hash_password(pwd)
            print(f'  {u.email}  ->  пароль: {pwd}')
        await db.commit()
        print(f'\nОбновлено: {len(users)} пользователей')

asyncio.run(reset())
