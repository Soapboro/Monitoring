# База данных: Система мониторинга успеваемости

## Выбор СУБД

**PostgreSQL 15+** — рекомендуемая СУБД для продакшна.

**Причины:**
- Аналитические оконные функции (нужны для отчётов по динамике успеваемости)
- JSONB с индексами (хранение вариантов ответов и ответов студентов)
- Надёжные транзакции (фиксация результатов тестирования)
- Полнотекстовый поиск на русском (pg_trgm)
- Хорошая масштабируемость при росте истории данных

**Для локальной разработки:** SQLite (schema_sqlite.sql)

## Структура БД (20 таблиц)

```
ПОЛЬЗОВАТЕЛИ                    УЧЕБНЫЙ ПРОЦЕСС
──────────────                  ───────────────
users                           departments
  ├── teachers                  groups
  └── students                  subjects
                                teaching_assignments
                                topics

ТЕСТИРОВАНИЕ                    АНАЛИТИКА
────────────                    ─────────
questions                       grades
  └── test_questions            attendance
tests                           adaptive_recommendations
  ├── test_assignments          notifications
  └── test_sessions             audit_log
        └── question_answers
```

## Ключевые решения

| Аспект | Решение | Обоснование |
|--------|---------|-------------|
| Варианты ответов | JSONB в `questions.options` | Разные типы вопросов имеют разную структуру |
| Ответы студентов | JSONB в `question_answers.answer_data` | Гибкость без изменения схемы |
| Адаптивность | `adaptive_recommendations` (mastery_level 0–1) | Отслеживание освоения каждой темы |
| История | `test_sessions.attempt_number` | Поддержка нескольких попыток |
| Аудит | `audit_log` с old_data/new_data | Отслеживание всех изменений оценок |

## Быстрый старт (PostgreSQL)

```bash
# Создать БД
createdb monitoring_db

# Применить схему
psql monitoring_db < schema_postgres.sql

# Загрузить начальные данные
psql monitoring_db < seed_data.sql
```

## Быстрый старт (разработка, SQLite)

```bash
python3 -c "
import sqlite3
conn = sqlite3.connect('monitoring.db')
conn.executescript(open('schema_sqlite.sql').read())
conn.commit()
print('Done')
"
```
