import asyncio
from app.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.teacher import Teacher
from app.models.student import Student
from app.security import hash_password
from sqlalchemy import select

async def create_demo():
    async with AsyncSessionLocal() as db:
        # Преподаватель
        existing = await db.execute(select(User).where(User.email == 'teacher@test.ru'))
        if not existing.scalar_one_or_none():
            user = User(email='teacher@test.ru', password_hash=hash_password('teacher1234'), role=UserRole.teacher)
            db.add(user)
            await db.flush()
            teacher = Teacher(
                user_id=user.id,
                last_name='Иванов',
                first_name='Иван',
                middle_name='Иванович',
                position='Преподаватель',
            )
            db.add(teacher)
            print(f'Преподаватель создан: teacher@test.ru / teacher1234 (teacher_id будет назначен)')
        else:
            print('Преподаватель teacher@test.ru уже существует')

        # Студент — нужна существующая группа
        existing = await db.execute(select(User).where(User.email == 'student@test.ru'))
        if not existing.scalar_one_or_none():
            from app.models.group import Group
            result = await db.execute(select(Group).limit(1))
            group = result.scalar_one_or_none()
            if group:
                user = User(email='student@test.ru', password_hash=hash_password('student1234'), role=UserRole.student)
                db.add(user)
                await db.flush()
                student = Student(
                    user_id=user.id,
                    last_name='Петров',
                    first_name='Пётр',
                    middle_name='Петрович',
                    group_id=group.id,
                    student_num='ST-001',
                )
                db.add(student)
                print(f'Студент создан: student@test.ru / student1234 (группа: {group.name})')
            else:
                print('Нет групп в БД — сначала залей schema + seed_data')
        else:
            print('Студент student@test.ru уже существует')

        await db.commit()
        print('\nГотово!')
        print('  Администратор:  admin@test.ru     / admin1234')
        print('  Преподаватель:  teacher@test.ru   / teacher1234')
        print('  Студент:        student@test.ru   / student1234')

asyncio.run(create_demo())
