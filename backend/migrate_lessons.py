"""
Миграция: создаёт таблицу lessons.
Запуск: python migrate_lessons.py
"""
import asyncio
from sqlalchemy import text
from app.database import engine


async def migrate():
    async with engine.begin() as conn:
        result = await conn.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_name = 'lessons'
        """))
        if result.fetchone():
            print("Таблица lessons уже существует, пропускаем.")
            return

        await conn.execute(text("""
            CREATE TYPE lesson_type_t AS ENUM ('lecture', 'practice', 'lab', 'seminar', 'other')
        """))

        await conn.execute(text("""
            CREATE TABLE lessons (
                id          SERIAL PRIMARY KEY,
                assignment_id INTEGER NOT NULL REFERENCES teaching_assignments(id) ON DELETE CASCADE,
                starts_at   TIMESTAMPTZ NOT NULL,
                ends_at     TIMESTAMPTZ NOT NULL,
                topic       VARCHAR(500),
                lesson_type lesson_type_t NOT NULL DEFAULT 'lecture',
                room        VARCHAR(100),
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT chk_lesson_times CHECK (ends_at > starts_at)
            )
        """))

        await conn.execute(text("""
            CREATE INDEX ix_lessons_assignment_id ON lessons(assignment_id);
            CREATE INDEX ix_lessons_starts_at ON lessons(starts_at);
        """))

        print("Таблица lessons успешно создана.")


if __name__ == "__main__":
    asyncio.run(migrate())
