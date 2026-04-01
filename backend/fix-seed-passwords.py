"""
Обновляет пароли для пользователей из seed_data (у них были заглушки вместо хэшей).
Пароль для всех: Password123
"""
import asyncio
from app.database import AsyncSessionLocal
from app.models.user import User
from app.security import hash_password
from sqlalchemy import select, update

SEED_EMAILS = [
    'anatolev@college.ru',
    'kuznetsova@college.ru',
    'morozov@college.ru',
    'sorokina@college.ru',
    'petrov.s@students.college.ru',
    'sidorova.m@students.college.ru',
    'voronov.d@students.college.ru',
    'lebedeva.a@students.college.ru',
    'kozlov.i@students.college.ru',
    'novikova.e@students.college.ru',
    'fedorov.n@students.college.ru',
    'zaitseva.o@students.college.ru',
    'sokolov.k@students.college.ru',
    'mihailova.v@students.college.ru',
    'alekseev.r@students.college.ru',
    'stepanova.l@students.college.ru',
    'dmitriev.a@students.college.ru',
    'ivanova.n@students.college.ru',
    'semenov.v@students.college.ru',
    'grigorieva.t@students.college.ru',
    'nikitin.p@students.college.ru',
    'popova.yu@students.college.ru',
]

NEW_PASSWORD = 'Password123'

async def fix():
    new_hash = hash_password(NEW_PASSWORD)
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email.in_(SEED_EMAILS)))
        users = result.scalars().all()
        for u in users:
            u.password_hash = new_hash
        await db.commit()
        print(f'Обновлено пользователей: {len(users)}')
        print(f'Новый пароль для всех: {NEW_PASSWORD}')
        print()
        print('Преподаватели:')
        for u in users:
            if u.role.value == 'teacher':
                print(f'  {u.email}')
        print()
        print('Студенты (первые 5):')
        students = [u for u in users if u.role.value == 'student']
        for u in students[:5]:
            print(f'  {u.email}')
        if len(students) > 5:
            print(f'  ... и ещё {len(students) - 5}')

asyncio.run(fix())
