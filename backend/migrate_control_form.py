"""
Миграция: переносит control_form из subjects в teaching_assignments.
Запуск: python migrate_control_form.py
"""
import asyncio
from sqlalchemy import text
from app.database import engine


async def migrate():
    async with engine.begin() as conn:
        # 1. Добавляем колонку в teaching_assignments (если нет)
        result = await conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'teaching_assignments' AND column_name = 'control_form'
        """))
        if not result.fetchone():
            await conn.execute(text("""
                ALTER TABLE teaching_assignments ADD COLUMN control_form VARCHAR(100)
            """))
            print("Добавлена колонка control_form в teaching_assignments")
        else:
            print("Колонка control_form в teaching_assignments уже есть")

        # 2. Переносим значения: для каждого назначения берём control_form из его дисциплины
        await conn.execute(text("""
            UPDATE teaching_assignments ta
            SET control_form = s.control_form
            FROM subjects s
            WHERE ta.subject_id = s.id
              AND s.control_form IS NOT NULL
              AND ta.control_form IS NULL
        """))
        print("Значения control_form перенесены из subjects в teaching_assignments")

        # 3. Удаляем колонку из subjects
        result = await conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'subjects' AND column_name = 'control_form'
        """))
        if result.fetchone():
            await conn.execute(text("""
                ALTER TABLE subjects DROP COLUMN control_form
            """))
            print("Колонка control_form удалена из subjects")
        else:
            print("Колонка control_form в subjects уже отсутствует")


if __name__ == "__main__":
    asyncio.run(migrate())
