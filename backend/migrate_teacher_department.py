"""
Миграция: добавляет колонку department_id в таблицу teachers.
Запуск: python migrate_teacher_department.py
"""
import asyncio
from sqlalchemy import text
from app.database import engine


async def migrate():
    async with engine.begin() as conn:
        # Проверяем, есть ли уже колонка
        result = await conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'teachers' AND column_name = 'department_id'
        """))
        if result.fetchone():
            print("Колонка department_id уже существует, пропускаем.")
            return

        await conn.execute(text("""
            ALTER TABLE teachers
            ADD COLUMN department_id INTEGER
            REFERENCES departments(id) ON DELETE SET NULL
        """))
        print("Колонка department_id успешно добавлена в таблицу teachers.")


if __name__ == "__main__":
    asyncio.run(migrate())
