"""
Полный сид: очищает базу и создаёт демо-данные для демонстрации всей функциональности.
Запуск: cd backend && python seed_full.py
"""
import asyncio
import random
from datetime import datetime, date, timedelta, timezone

OMSK = timezone(timedelta(hours=6))

from sqlalchemy import text
from app.database import AsyncSessionLocal, engine, Base
from app.models import (
    User, UserRole,
    Department, Group,
    Teacher, Student,
    Subject, TeachingAssignment,
    Topic,
    Question, QuestionType, Difficulty,
    Test, TestStatus, TestQuestion, TestAssignment,
    TestSession, SessionStatus, QuestionAnswer,
    Grade, GradeType,
    Lesson, LessonType,
    Attendance,
)
from app.security import hash_password


def dt(y, mo, d, h=8, mi=0) -> datetime:
    return datetime(y, mo, d, h, mi, tzinfo=OMSK)


def today_dt(days_offset: int = 0, h: int = 10) -> datetime:
    base = date(2026, 4, 14)
    d = base + timedelta(days=days_offset)
    return datetime(d.year, d.month, d.day, h, 0, tzinfo=OMSK)


# ─────────────────────────────────────────────────────────────────
# RESET
# ─────────────────────────────────────────────────────────────────

async def reset_db():
    """Удаляем все строки в правильном порядке."""
    async with engine.begin() as conn:
        await conn.execute(text("SET session_replication_role = replica"))
        for tbl in reversed(Base.metadata.sorted_tables):
            await conn.execute(tbl.delete())
        await conn.execute(text("SET session_replication_role = DEFAULT"))
    print("DB очищена.")


# ─────────────────────────────────────────────────────────────────
# SEED
# ─────────────────────────────────────────────────────────────────

async def seed():
    async with AsyncSessionLocal() as db:

        # ── 1. Кафедры ──────────────────────────────────────────────
        dep_cs   = Department(name="Кафедра информатики и вычислительной техники", code="ИВТ",
                              description="Подготовка специалистов в области ИТ и программирования")
        dep_math = Department(name="Кафедра математики и естественных наук", code="МЕН",
                              description="Фундаментальная математика, анализ и прикладные науки")
        db.add_all([dep_cs, dep_math])
        await db.flush()

        # ── 2. Группы ───────────────────────────────────────────────
        g21 = Group(name="ИВТ-21", year_start=2021, department_id=dep_cs.id,   is_active=True)
        g22 = Group(name="ИВТ-22", year_start=2022, department_id=dep_cs.id,   is_active=True)
        g23 = Group(name="ИВТ-23", year_start=2023, department_id=dep_cs.id,   is_active=True)
        gm21= Group(name="МАТ-21", year_start=2021, department_id=dep_math.id, is_active=True)
        db.add_all([g21, g22, g23, gm21])
        await db.flush()

        # ── 3. Пользователи ─────────────────────────────────────────
        u_admin = User(email="admin@demo.ru",    password_hash=hash_password("admin1234"),   role=UserRole.admin)
        u_t1    = User(email="ivanov@demo.ru",   password_hash=hash_password("teacher1234"), role=UserRole.teacher)
        u_t2    = User(email="smirnova@demo.ru", password_hash=hash_password("teacher1234"), role=UserRole.teacher)
        u_t3    = User(email="petrov@demo.ru",   password_hash=hash_password("teacher1234"), role=UserRole.teacher)

        # Студенты ИВТ-21 (6 чел.)
        s_names_21 = [
            ("Александров", "Иван",      "Сергеевич",    date(2003, 3, 15), "2021001"),
            ("Белова",      "Мария",     "Андреевна",    date(2003, 7, 22), "2021002"),
            ("Громов",      "Артём",     "Олегович",     date(2003, 1, 10), "2021003"),
            ("Дмитриева",   "Анастасия", "Ивановна",     date(2002,11, 5),  "2021004"),
            ("Ефимов",      "Дмитрий",   "Николаевич",   date(2003, 5, 30), "2021005"),
            ("Жукова",      "Полина",    "Романовна",    date(2003, 9, 12), "2021006"),
        ]
        # Студенты ИВТ-22 (5 чел.)
        s_names_22 = [
            ("Зайцев",      "Никита",    "Алексеевич",   date(2004, 2, 18), "2022001"),
            ("Иванова",     "София",     "Павловна",     date(2004, 8,  9), "2022002"),
            ("Козлов",      "Антон",     "Вячеславович", date(2004, 4,  3), "2022003"),
            ("Лебедева",    "Виктория",  "Денисовна",    date(2004, 6, 25), "2022004"),
            ("Морозов",     "Кирилл",    "Игоревич",     date(2004,12,  1), "2022005"),
        ]
        # Студенты ИВТ-23 (4 чел.)
        s_names_23 = [
            ("Никитин",     "Глеб",      "Тимурович",    date(2005, 3, 20), "2023001"),
            ("Орлова",      "Дарья",     "Евгеньевна",   date(2005, 6, 14), "2023002"),
            ("Павлов",      "Максим",    "Юрьевич",      date(2005, 1,  8), "2023003"),
            ("Романова",    "Алина",     "Викторовна",   date(2005, 9,  3), "2023004"),
        ]
        # Студенты МАТ-21 (5 чел.)
        s_names_m21 = [
            ("Сорокин",     "Михаил",    "Фёдорович",    date(2003, 4, 19), "2021101"),
            ("Тихонова",    "Екатерина", "Михайловна",   date(2003, 8, 25), "2021102"),
            ("Ульянов",     "Владимир",  "Дмитриевич",   date(2002,10,  7), "2021103"),
            ("Фёдорова",    "Ксения",    "Олеговна",     date(2003, 2, 11), "2021104"),
            ("Харитонов",   "Алексей",   "Петрович",     date(2003, 7,  4), "2021105"),
        ]

        def make_user_list(n):
            return [User(email=f"stub_{i}@x.ru", password_hash=hash_password("x"), role=UserRole.student)
                    for i in range(n)]

        us_21  = [User(email=f"s{i+1}_ivt21@demo.ru", password_hash=hash_password("student1234"), role=UserRole.student) for i in range(len(s_names_21))]
        us_22  = [User(email=f"s{i+1}_ivt22@demo.ru", password_hash=hash_password("student1234"), role=UserRole.student) for i in range(len(s_names_22))]
        us_23  = [User(email=f"s{i+1}_ivt23@demo.ru", password_hash=hash_password("student1234"), role=UserRole.student) for i in range(len(s_names_23))]
        us_m21 = [User(email=f"s{i+1}_mat21@demo.ru", password_hash=hash_password("student1234"), role=UserRole.student) for i in range(len(s_names_m21))]

        all_users = [u_admin, u_t1, u_t2, u_t3] + us_21 + us_22 + us_23 + us_m21
        db.add_all(all_users)
        await db.flush()

        # ── 4. Преподаватели ────────────────────────────────────────
        t1 = Teacher(user_id=u_t1.id, last_name="Иванов",   first_name="Александр", middle_name="Петрович",
                     position="Доцент",               department_id=dep_cs.id,   phone="+7-900-111-22-33")
        t2 = Teacher(user_id=u_t2.id, last_name="Смирнова", first_name="Елена",     middle_name="Васильевна",
                     position="Старший преподаватель", department_id=dep_math.id, phone="+7-900-444-55-66")
        t3 = Teacher(user_id=u_t3.id, last_name="Петрова",  first_name="Ольга",     middle_name="Игоревна",
                     position="Преподаватель",         department_id=dep_cs.id,   phone="+7-900-777-88-99")
        db.add_all([t1, t2, t3])
        await db.flush()

        # ── 5. Студенты ─────────────────────────────────────────────
        def make_students(users, names, group_id):
            return [Student(user_id=u.id, last_name=n[0], first_name=n[1], middle_name=n[2],
                            birth_date=n[3], group_id=group_id, student_num=n[4], is_active=True)
                    for u, n in zip(users, names)]

        sts_21  = make_students(us_21,  s_names_21,  g21.id)
        sts_22  = make_students(us_22,  s_names_22,  g22.id)
        sts_23  = make_students(us_23,  s_names_23,  g23.id)
        sts_m21 = make_students(us_m21, s_names_m21, gm21.id)
        all_students = sts_21 + sts_22 + sts_23 + sts_m21
        db.add_all(all_students)
        await db.flush()

        # ── 6. Предметы ─────────────────────────────────────────────
        subj_py   = Subject(name="Программирование на Python",  code="CS101", hours_total=72,  department_id=dep_cs.id)
        subj_db   = Subject(name="Базы данных",                 code="CS201", hours_total=54,  department_id=dep_cs.id)
        subj_web  = Subject(name="Веб-разработка",              code="CS301", hours_total=54,  department_id=dep_cs.id)
        subj_math = Subject(name="Высшая математика",           code="MA101", hours_total=108, department_id=dep_math.id)
        db.add_all([subj_py, subj_db, subj_web, subj_math])
        await db.flush()

        # ── 7. Привязки ─────────────────────────────────────────────
        ta_py21  = TeachingAssignment(teacher_id=t1.id, subject_id=subj_py.id,  group_id=g21.id,  semester=6, acad_year="2024-2025")
        ta_py22  = TeachingAssignment(teacher_id=t1.id, subject_id=subj_py.id,  group_id=g22.id,  semester=4, acad_year="2024-2025")
        ta_db22  = TeachingAssignment(teacher_id=t1.id, subject_id=subj_db.id,  group_id=g22.id,  semester=4, acad_year="2024-2025")
        ta_web23 = TeachingAssignment(teacher_id=t3.id, subject_id=subj_web.id, group_id=g23.id,  semester=2, acad_year="2024-2025")
        ta_db23  = TeachingAssignment(teacher_id=t3.id, subject_id=subj_db.id,  group_id=g23.id,  semester=2, acad_year="2024-2025")
        ta_math  = TeachingAssignment(teacher_id=t2.id, subject_id=subj_math.id,group_id=gm21.id, semester=6, acad_year="2024-2025")
        db.add_all([ta_py21, ta_py22, ta_db22, ta_web23, ta_db23, ta_math])
        await db.flush()

        # ── 8. Темы ─────────────────────────────────────────────────
        # Python
        tp_types  = Topic(subject_id=subj_py.id, title="Типы данных и переменные",    order_num=1)
        tp_oop    = Topic(subject_id=subj_py.id, title="ООП: классы и объекты",        order_num=2)
        tp_async  = Topic(subject_id=subj_py.id, title="Декораторы и асинхронность",   order_num=3)
        # БД
        td_sql    = Topic(subject_id=subj_db.id, title="SQL: основы и DDL",            order_num=1)
        td_join   = Topic(subject_id=subj_db.id, title="JOIN и подзапросы",            order_num=2)
        td_index  = Topic(subject_id=subj_db.id, title="Индексы и оптимизация",        order_num=3)
        # Веб
        tw_html   = Topic(subject_id=subj_web.id, title="HTML и CSS основы",           order_num=1)
        tw_js     = Topic(subject_id=subj_web.id, title="JavaScript и DOM",            order_num=2)
        # Матан
        tm_lim    = Topic(subject_id=subj_math.id, title="Пределы функций",            order_num=1)
        tm_deriv  = Topic(subject_id=subj_math.id, title="Производная",                order_num=2)
        tm_integ  = Topic(subject_id=subj_math.id, title="Интеграл",                   order_num=3)

        all_topics = [tp_types, tp_oop, tp_async, td_sql, td_join, td_index, tw_html, tw_js, tm_lim, tm_deriv, tm_integ]
        db.add_all(all_topics)
        await db.flush()

        # ── 9. Вопросы ──────────────────────────────────────────────
        _IDS = 'abcdefghij'
        def sc(choices): return {"choices": [{"id": _IDS[i], "text": c["text"], "is_correct": c["is_correct"]} for i, c in enumerate(choices)]}
        def ch(text, correct): return {"text": text, "is_correct": correct}

        questions_py_types = [
            Question(topic_id=tp_types.id, author_id=t1.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.easy, score_max=1,
                     body="Какой тип данных у выражения 3 / 2 в Python 3?",
                     options=sc([ch("int", False), ch("float", True), ch("str", False), ch("complex", False)]),
                     explanation="Деление / всегда возвращает float."),
            Question(topic_id=tp_types.id, author_id=t1.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.easy, score_max=1,
                     body="Что выведет: print(type(True))?",
                     options=sc([ch("<class 'int'>", False), ch("<class 'bool'>", True), ch("<class 'str'>", False), ch("True", False)]),
                     explanation="bool — отдельный тип, подкласс int."),
            Question(topic_id=tp_types.id, author_id=t1.id, question_type=QuestionType.multiple_choice,
                     difficulty=Difficulty.medium, score_max=1,
                     body="Какие из следующих типов являются изменяемыми (mutable)?",
                     options=sc([{"id": "a", "text": "list",  "is_correct": True},
                                 {"id": "b", "text": "tuple", "is_correct": False},
                                 {"id": "c", "text": "dict",  "is_correct": True},
                                 {"id": "d", "text": "str",   "is_correct": False},
                                 {"id": "e", "text": "set",   "is_correct": True}]),
                     explanation="list, dict, set — изменяемые; tuple, str, frozenset — нет."),
        ]

        questions_py_oop = [
            Question(topic_id=tp_oop.id, author_id=t1.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.medium, score_max=1,
                     body="Какой метод вызывается при создании экземпляра класса?",
                     options=sc([ch("__new__", False), ch("__init__", True), ch("__create__", False), ch("__call__", False)]),
                     explanation="__init__ вызывается автоматически при создании объекта."),
            Question(topic_id=tp_oop.id, author_id=t1.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.medium, score_max=1,
                     body="Что означает принцип инкапсуляции в ООП?",
                     options=sc([ch("Наследование классов", False),
                                 ch("Скрытие внутренней реализации", True),
                                 ch("Перегрузка методов", False),
                                 ch("Множественное наследование", False)]),
                     explanation="Инкапсуляция — скрытие деталей реализации от внешнего кода."),
            Question(topic_id=tp_oop.id, author_id=t1.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.hard, score_max=1,
                     body="Что выведет: class A: x=1\nclass B(A): pass\nB.x = 2\nprint(A.x)?",
                     options=sc([ch("1", True), ch("2", False), ch("None", False), ch("Ошибка", False)]),
                     explanation="Изменение атрибута в подклассе не затрагивает родительский класс."),
        ]

        questions_py_async = [
            Question(topic_id=tp_async.id, author_id=t1.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.hard, score_max=1,
                     body="Что вернёт функция с декоратором @property?",
                     options=sc([ch("Функцию-геттер", False), ch("Значение атрибута при обращении", True),
                                 ch("Дескриптор", False), ch("None", False)]),
                     explanation="@property позволяет обращаться к методу как к атрибуту."),
            Question(topic_id=tp_async.id, author_id=t1.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.hard, score_max=1,
                     body="Какое ключевое слово используется для приостановки выполнения корутины?",
                     options=sc([ch("yield", False), ch("await", True), ch("pause", False), ch("suspend", False)]),
                     explanation="await приостанавливает выполнение до завершения awaitable-объекта."),
            Question(topic_id=tp_async.id, author_id=t1.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.hard, score_max=1,
                     body="Какой модуль стандартной библиотеки реализует цикл событий?",
                     options=sc([ch("threading", False), ch("asyncio", True), ch("concurrent", False), ch("multiprocessing", False)]),
                     explanation="asyncio — стандартная библиотека Python для асинхронного программирования."),
        ]

        questions_db_sql = [
            Question(topic_id=td_sql.id, author_id=t1.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.easy, score_max=1,
                     body="Какой оператор SQL используется для создания таблицы?",
                     options=sc([ch("INSERT TABLE", False), ch("CREATE TABLE", True), ch("MAKE TABLE", False), ch("NEW TABLE", False)]),
                     explanation="CREATE TABLE — DDL-оператор для создания новой таблицы."),
            Question(topic_id=td_sql.id, author_id=t1.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.easy, score_max=1,
                     body="Что делает оператор SELECT DISTINCT?",
                     options=sc([ch("Выбирает первую запись", False), ch("Убирает дублирующиеся строки", True),
                                 ch("Сортирует результат", False), ch("Ограничивает количество строк", False)]),
                     explanation="DISTINCT убирает дубликаты из результирующего набора."),
            Question(topic_id=td_sql.id, author_id=t1.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.medium, score_max=1,
                     body="Какое ограничение гарантирует уникальность значений в столбце?",
                     options=sc([ch("NOT NULL", False), ch("UNIQUE", True), ch("CHECK", False), ch("DEFAULT", False)]),
                     explanation="UNIQUE обеспечивает уникальность значений в столбце или наборе столбцов."),
        ]

        questions_db_join = [
            Question(topic_id=td_join.id, author_id=t1.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.medium, score_max=1,
                     body="Какой тип JOIN возвращает только совпадающие строки из обеих таблиц?",
                     options=sc([ch("LEFT JOIN", False), ch("INNER JOIN", True), ch("FULL JOIN", False), ch("CROSS JOIN", False)]),
                     explanation="INNER JOIN возвращает только строки, для которых есть совпадение в обеих таблицах."),
            Question(topic_id=td_join.id, author_id=t1.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.hard, score_max=1,
                     body="Что делает коррелированный подзапрос?",
                     options=sc([ch("Выполняется один раз для всего запроса", False),
                                 ch("Выполняется для каждой строки внешнего запроса", True),
                                 ch("Заменяет JOIN", False),
                                 ch("Оптимизируется в индексный scan", False)]),
                     explanation="Коррелированный подзапрос зависит от строки внешнего запроса и выполняется для каждой строки."),
            Question(topic_id=td_join.id, author_id=t1.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.hard, score_max=1,
                     body="Что возвращает LEFT JOIN, если правая таблица не имеет совпадений?",
                     options=sc([ch("Ничего (строка пропускается)", False),
                                 ch("Строку с NULL в полях правой таблицы", True),
                                 ch("Строку с пустыми строками", False),
                                 ch("Ошибку", False)]),
                     explanation="LEFT JOIN сохраняет все строки из левой таблицы; при отсутствии совпадения — NULL."),
        ]

        questions_db_index = [
            Question(topic_id=td_index.id, author_id=t1.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.hard, score_max=1,
                     body="Когда индекс не используется оптимизатором запросов?",
                     options=sc([ch("Поиск по первичному ключу", False),
                                 ch("Функция над индексированным столбцом в WHERE", True),
                                 ch("Поиск по одному значению", False),
                                 ch("ORDER BY по индексированному столбцу", False)]),
                     explanation="WHERE UPPER(col) = 'X' не использует индекс по col, так как применяется функция."),
            Question(topic_id=td_index.id, author_id=t1.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.medium, score_max=1,
                     body="Что такое составной индекс?",
                     options=sc([ch("Индекс по нескольким таблицам", False),
                                 ch("Индекс по нескольким столбцам одной таблицы", True),
                                 ch("Кластеризованный индекс", False),
                                 ch("Уникальный индекс", False)]),
                     explanation="Составной (composite) индекс охватывает два и более столбца одной таблицы."),
            Question(topic_id=td_index.id, author_id=t1.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.hard, score_max=1,
                     body="Какой план выполнения говорит о полном переборе таблицы?",
                     options=sc([ch("Index Scan", False), ch("Seq Scan", True), ch("Bitmap Heap Scan", False), ch("Nested Loop", False)]),
                     explanation="Seq Scan (Sequential Scan) — последовательный перебор всех строк таблицы."),
        ]

        questions_web_html = [
            Question(topic_id=tw_html.id, author_id=t3.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.easy, score_max=1,
                     body="Какой HTML-тег используется для ссылки?",
                     options=sc([ch("<link>", False), ch("<a>", True), ch("<href>", False), ch("<url>", False)])),
            Question(topic_id=tw_html.id, author_id=t3.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.easy, score_max=1,
                     body="Какое CSS-свойство отвечает за цвет текста?",
                     options=sc([ch("background-color", False), ch("color", True), ch("text-color", False), ch("font-color", False)])),
            Question(topic_id=tw_html.id, author_id=t3.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.medium, score_max=1,
                     body="Что означает display: flex?",
                     options=sc([ch("Скрыть элемент", False), ch("Включить флекс-контейнер", True),
                                 ch("Сделать элемент блочным", False), ch("Включить grid", False)])),
        ]

        questions_web_js = [
            Question(topic_id=tw_js.id, author_id=t3.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.medium, score_max=1,
                     body="Что делает метод getElementById?",
                     options=sc([ch("Создаёт элемент", False), ch("Находит элемент по id", True),
                                 ch("Удаляет элемент", False), ch("Изменяет CSS", False)])),
            Question(topic_id=tw_js.id, author_id=t3.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.medium, score_max=1,
                     body="Что выведет: console.log(typeof null)?",
                     options=sc([ch("null", False), ch("object", True), ch("undefined", False), ch("string", False)]),
                     explanation="typeof null === 'object' — историческая ошибка JavaScript."),
            Question(topic_id=tw_js.id, author_id=t3.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.hard, score_max=1,
                     body="Чем отличается == от === в JavaScript?",
                     options=sc([ch("Нет разницы", False),
                                 ch("=== проверяет тип и значение без приведения", True),
                                 ch("=== только для строк", False),
                                 ch("== всегда строже", False)])),
        ]

        questions_math_lim = [
            Question(topic_id=tm_lim.id, author_id=t2.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.medium, score_max=1,
                     body="Чему равен lim(x→0) sin(x)/x?",
                     options=sc([ch("0", False), ch("1", True), ch("∞", False), ch("Не существует", False)]),
                     explanation="Первый замечательный предел: lim(x→0) sin(x)/x = 1."),
            Question(topic_id=tm_lim.id, author_id=t2.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.medium, score_max=1,
                     body="Что такое число e в контексте пределов?",
                     options=sc([ch("lim(n→∞)(1 + 1/n)^n", True), ch("π/2", False), ch("√2", False), ch("lim(x→0)x^x", False)]),
                     explanation="e = lim(n→∞)(1 + 1/n)^n ≈ 2.718 — второй замечательный предел."),
            Question(topic_id=tm_lim.id, author_id=t2.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.hard, score_max=1,
                     body="Чему равен lim(x→∞) (1 + 3/x)^x?",
                     options=sc([ch("1", False), ch("e³", True), ch("3e", False), ch("∞", False)]),
                     explanation="lim(x→∞)(1 + a/x)^x = e^a."),
        ]

        questions_math_deriv = [
            Question(topic_id=tm_deriv.id, author_id=t2.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.easy, score_max=1,
                     body="Чему равна производная f(x) = x³?",
                     options=sc([ch("x²", False), ch("3x²", True), ch("3x", False), ch("x³", False)]),
                     explanation="(x^n)' = n·x^(n-1)."),
            Question(topic_id=tm_deriv.id, author_id=t2.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.medium, score_max=1,
                     body="Какая производная у f(x) = e^x?",
                     options=sc([ch("xe^(x-1)", False), ch("e^x", True), ch("e^(x-1)", False), ch("ln(x)", False)]),
                     explanation="e^x — единственная нетривиальная функция, равная своей производной."),
            Question(topic_id=tm_deriv.id, author_id=t2.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.hard, score_max=1,
                     body="Производная f(x) = ln(sin(x)) равна?",
                     options=sc([ch("1/sin(x)", False), ch("cos(x)/sin(x)", True), ch("-cot(x)", False), ch("sin(x)/cos(x)", False)]),
                     explanation="По правилу цепочки: (ln(g(x)))' = g'(x)/g(x); (sin x)' = cos x."),
        ]

        questions_math_integ = [
            Question(topic_id=tm_integ.id, author_id=t2.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.medium, score_max=1,
                     body="Чему равен ∫x² dx?",
                     options=sc([ch("2x + C", False), ch("x³/3 + C", True), ch("x²/2 + C", False), ch("3x³ + C", False)]),
                     explanation="∫x^n dx = x^(n+1)/(n+1) + C."),
            Question(topic_id=tm_integ.id, author_id=t2.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.hard, score_max=1,
                     body="Какой метод используется для ∫x·e^x dx?",
                     options=sc([ch("Замена переменной", False), ch("Интегрирование по частям", True),
                                 ch("Разложение на простые дроби", False), ch("Рекуррентная формула", False)]),
                     explanation="∫u dv = uv − ∫v du. Здесь u=x, dv=e^x dx."),
            Question(topic_id=tm_integ.id, author_id=t2.id, question_type=QuestionType.single_choice,
                     difficulty=Difficulty.hard, score_max=1,
                     body="Что утверждает основная теорема анализа (Ньютона–Лейбница)?",
                     options=sc([ch("Каждая непрерывная функция интегрируема", False),
                                 ch("∫[a,b] f(x)dx = F(b) − F(a), где F' = f", True),
                                 ch("Производная интеграла равна интегранду", False),
                                 ch("Интеграл произведения равен произведению интегралов", False)]),
                     explanation="Теорема Ньютона–Лейбница связывает дифференциальное и интегральное исчисление."),
        ]

        all_questions = (questions_py_types + questions_py_oop + questions_py_async
                        + questions_db_sql + questions_db_join + questions_db_index
                        + questions_web_html + questions_web_js
                        + questions_math_lim + questions_math_deriv + questions_math_integ)
        db.add_all(all_questions)
        await db.flush()

        # ── 10. Тесты ───────────────────────────────────────────────
        test_py1 = Test(subject_id=subj_py.id, author_id=t1.id,
                        title="Python: Основы и ООП", status=TestStatus.published,
                        time_limit_minutes=30, attempts_allowed=2, passing_score_pct=60,
                        shuffle_questions=False, shuffle_options=False, show_results=True)
        test_py2 = Test(subject_id=subj_py.id, author_id=t1.id,
                        title="Python: Декораторы и async", status=TestStatus.published,
                        time_limit_minutes=20, attempts_allowed=1, passing_score_pct=70,
                        shuffle_questions=False, shuffle_options=False, show_results=True)
        test_db  = Test(subject_id=subj_db.id,  author_id=t1.id,
                        title="Базы данных: SQL и оптимизация", status=TestStatus.published,
                        time_limit_minutes=40, attempts_allowed=2, passing_score_pct=60,
                        shuffle_questions=False, shuffle_options=False, show_results=True)
        test_web = Test(subject_id=subj_web.id, author_id=t3.id,
                        title="Веб: HTML/CSS/JS", status=TestStatus.published,
                        time_limit_minutes=25, attempts_allowed=2, passing_score_pct=60,
                        shuffle_questions=False, shuffle_options=False, show_results=True)
        test_math= Test(subject_id=subj_math.id, author_id=t2.id,
                        title="Матанализ: пределы, производные, интегралы", status=TestStatus.published,
                        time_limit_minutes=50, attempts_allowed=2, passing_score_pct=60,
                        shuffle_questions=False, shuffle_options=False, show_results=True)
        db.add_all([test_py1, test_py2, test_db, test_web, test_math])
        await db.flush()

        # ── 11. Вопросы тестов ──────────────────────────────────────
        def add_tqs(test, questions):
            tqs = []
            for i, q in enumerate(questions):
                tqs.append(TestQuestion(test_id=test.id, question_id=q.id, order_num=i+1, score_max=q.score_max))
            return tqs

        tqs_py1  = add_tqs(test_py1, questions_py_types + questions_py_oop)   # 6 вопросов
        tqs_py2  = add_tqs(test_py2, questions_py_async)                       # 3 вопроса
        tqs_db   = add_tqs(test_db,  questions_db_sql + questions_db_join + questions_db_index)  # 9 вопросов
        tqs_web  = add_tqs(test_web, questions_web_html + questions_web_js)    # 6 вопросов
        tqs_math = add_tqs(test_math, questions_math_lim + questions_math_deriv + questions_math_integ)  # 9 вопросов

        db.add_all(tqs_py1 + tqs_py2 + tqs_db + tqs_web + tqs_math)
        await db.flush()

        # ── 12. Назначения тестов группам ───────────────────────────
        db.add_all([
            TestAssignment(test_id=test_py1.id, group_id=g21.id, assigned_by=t1.id),
            TestAssignment(test_id=test_py2.id, group_id=g21.id, assigned_by=t1.id),
            TestAssignment(test_id=test_py1.id, group_id=g22.id, assigned_by=t1.id),
            TestAssignment(test_id=test_db.id,  group_id=g22.id, assigned_by=t1.id),
            TestAssignment(test_id=test_web.id, group_id=g23.id, assigned_by=t3.id),
            TestAssignment(test_id=test_db.id,  group_id=g23.id, assigned_by=t3.id),
            TestAssignment(test_id=test_math.id,group_id=gm21.id,assigned_by=t2.id),
        ])
        await db.flush()

        # ── 13. Тестовые сессии и ответы ────────────────────────────
        # Правильные ответы для каждого вопроса (индекс choices с is_correct=True)
        # Для SC: ключ — 'id' правильного варианта
        def correct_id(q: Question) -> str | list:
            choices = q.options["choices"]
            if q.question_type == QuestionType.multiple_choice:
                return [c["id"] for c in choices if c["is_correct"]]
            return next(c["id"] for c in choices if c["is_correct"])

        def wrong_id(q: Question) -> str | list:
            choices = q.options["choices"]
            if q.question_type == QuestionType.multiple_choice:
                # вернём первый неправильный вариант как единственный выбор
                wrong = [c["id"] for c in choices if not c["is_correct"]]
                return wrong[:1] if wrong else [choices[0]["id"]]
            return next(c["id"] for c in choices if not c["is_correct"])

        sessions_all = []
        answers_all  = []

        def make_session(test, student, started, duration_sec, correct_mask, questions_for_test):
            """
            correct_mask: список True/False для каждого вопроса теста
            """
            n_correct = sum(correct_mask)
            score_max = float(len(questions_for_test))
            score_total = float(n_correct)
            passed = (score_total / score_max * 100) >= float(test.passing_score_pct)
            finished = started + timedelta(seconds=duration_sec)

            sess = TestSession(
                test_id=test.id,
                student_id=student.id,
                attempt_number=1,
                status=SessionStatus.completed,
                started_at=started,
                finished_at=finished,
                score_total=score_total,
                score_max=score_max,
                passed=passed,
            )
            sessions_all.append(sess)
            return sess, correct_mask, questions_for_test

        def make_answers(sess, correct_mask, questions_for_test, total_sec):
            per_q = max(10, total_sec // len(questions_for_test))
            for q, is_correct in zip(questions_for_test, correct_mask):
                if is_correct:
                    ans_data = {"selected": correct_id(q)} if q.question_type != QuestionType.multiple_choice \
                               else {"selected": correct_id(q)}
                else:
                    ans_data = {"selected": wrong_id(q)} if q.question_type != QuestionType.multiple_choice \
                               else {"selected": wrong_id(q)}
                # небольшой разброс времени
                t_spent = per_q + random.randint(-5, 10)
                answers_all.append(QuestionAnswer(
                    session_id=sess.id,
                    question_id=q.id,
                    answer_data=ans_data,
                    is_correct=is_correct,
                    score_earned=float(q.score_max) if is_correct else 0.0,
                    time_spent_sec=max(5, t_spent),
                ))

        # ── ИВТ-21: test_py1 (6 вопросов, 30 мин), test_py2 (3 вопроса, 20 мин)
        # Вопросы для py1: questions_py_types[0..2] + questions_py_oop[0..2]
        qs_py1 = questions_py_types + questions_py_oop
        qs_py2 = questions_py_async

        # Паттерны ответов для ИВТ-21 (6 студентов):
        # Александров — отличник: py1 5/6, py2 3/3
        # Белова — хорошист: py1 5/6, py2 2/3
        # Громов — средний: py1 3/6, py2 1/3
        # Дмитриева — хорошист: py1 4/6, py2 2/3
        # Ефимов — слабый: py1 2/6, py2 0/3
        # Жукова — хорошист: py1 4/6, py2 2/3

        py1_patterns = {
            sts_21[0]: ([True,True,True,True,True,False], 1450),   # 5/6, 24 мин
            sts_21[1]: ([True,True,True,True,False,True], 1600),   # 5/6, 27 мин
            sts_21[2]: ([True,True,False,False,True,False], 900),  # 3/6, 15 мин
            sts_21[3]: ([True,False,True,True,True,False], 1350),  # 4/6, 22 мин
            sts_21[4]: ([True,False,False,False,True,False], 750), # 2/6, 12 мин — слабый
            sts_21[5]: ([True,True,False,True,True,False], 1200),  # 4/6, 20 мин
        }
        py2_patterns = {
            sts_21[0]: ([True,True,True],  900),   # 3/3, 15 мин
            sts_21[1]: ([True,True,False], 780),   # 2/3, 13 мин
            sts_21[2]: ([True,False,False],540),   # 1/3, 9 мин
            sts_21[3]: ([True,False,True], 720),   # 2/3, 12 мин
            sts_21[4]: ([False,False,False],480),  # 0/3, 8 мин — слабый
            sts_21[5]: ([True,True,False], 660),   # 2/3, 11 мин
        }

        base_date_21 = datetime(2026, 3, 20, 9, 0, tzinfo=OMSK)
        for i, st in enumerate(sts_21):
            started = base_date_21 + timedelta(days=i % 3, hours=i // 3)
            mask, dur = py1_patterns[st]
            sess, m, qs = make_session(test_py1, st, started, dur, mask, qs_py1)

        # flush чтобы получить id сессий
        db.add_all(sessions_all)
        await db.flush()

        # добавляем ответы к py1
        i = 0
        for st in sts_21:
            started = base_date_21 + timedelta(days=i % 3, hours=i // 3)
            mask, dur = py1_patterns[st]
            # найдём нужную сессию
            sess = sessions_all[i]
            make_answers(sess, mask, qs_py1, dur)
            i += 1

        # py2
        sessions_py2 = []
        base_date_py2 = datetime(2026, 4, 1, 10, 0, tzinfo=OMSK)
        for j, st in enumerate(sts_21):
            started = base_date_py2 + timedelta(hours=j)
            mask, dur = py2_patterns[st]
            score_max = float(len(qs_py2))
            score_total = float(sum(mask))
            passed = (score_total / score_max * 100) >= float(test_py2.passing_score_pct)
            sess = TestSession(
                test_id=test_py2.id, student_id=st.id, attempt_number=1,
                status=SessionStatus.completed,
                started_at=started, finished_at=started + timedelta(seconds=dur),
                score_total=score_total, score_max=score_max, passed=passed,
            )
            sessions_py2.append(sess)

        db.add_all(sessions_py2)
        await db.flush()

        for j, (st, sess) in enumerate(zip(sts_21, sessions_py2)):
            mask, dur = py2_patterns[st]
            make_answers(sess, mask, qs_py2, dur)

        # ── ИВТ-22: test_py1 (как повтор) + test_db (9 вопросов)
        qs_db = questions_db_sql + questions_db_join + questions_db_index

        db22_patterns = {
            sts_22[0]: ([True,True,True,True,False,False,True,False,False], 2100),  # 4/9, 35 мин — ср.
            sts_22[1]: ([True,True,True,True,True,False,False,False,False], 1800),  # 5/9, 30 мин
            sts_22[2]: ([True,False,True,True,False,False,False,False,False], 1500),# 3/9, 25 мин — слабый
            sts_22[3]: ([True,True,True,True,True,True,True,False,False], 2400),    # 7/9, 40 мин — хорошо
            sts_22[4]: ([True,True,True,True,True,True,True,True,False], 2700),     # 8/9, 45 мин — отлично
        }
        py1_22_patterns = {
            sts_22[0]: ([True,True,False,True,True,False], 1300),
            sts_22[1]: ([True,True,True,True,True,True], 1700),
            sts_22[2]: ([True,False,False,True,False,False], 800),
            sts_22[3]: ([True,True,True,True,False,True], 1500),
            sts_22[4]: ([True,True,True,True,True,True], 1800),
        }

        sessions_db22 = []
        sessions_py1_22 = []
        base_date_22 = datetime(2026, 3, 22, 9, 0, tzinfo=OMSK)

        for j, st in enumerate(sts_22):
            started_db  = base_date_22 + timedelta(days=j % 2, hours=j // 2 * 2)
            started_py1 = base_date_22 + timedelta(days=4 + j % 2)
            mask_db, dur_db = db22_patterns[st]
            mask_py, dur_py = py1_22_patterns[st]

            sess_db = TestSession(test_id=test_db.id, student_id=st.id, attempt_number=1,
                status=SessionStatus.completed,
                started_at=started_db, finished_at=started_db+timedelta(seconds=dur_db),
                score_total=float(sum(mask_db)), score_max=float(len(qs_db)),
                passed=(sum(mask_db)/len(qs_db)*100) >= float(test_db.passing_score_pct))
            sess_py = TestSession(test_id=test_py1.id, student_id=st.id, attempt_number=1,
                status=SessionStatus.completed,
                started_at=started_py1, finished_at=started_py1+timedelta(seconds=dur_py),
                score_total=float(sum(mask_py)), score_max=float(len(qs_py1)),
                passed=(sum(mask_py)/len(qs_py1)*100) >= float(test_py1.passing_score_pct))
            sessions_db22.append((sess_db, mask_db, dur_db))
            sessions_py1_22.append((sess_py, mask_py, dur_py))

        sess_objs_22 = [s for s, _, _ in sessions_db22] + [s for s, _, _ in sessions_py1_22]
        db.add_all(sess_objs_22)
        await db.flush()

        for (sess, mask, dur) in sessions_db22:
            make_answers(sess, mask, qs_db, dur)
        for (sess, mask, dur) in sessions_py1_22:
            make_answers(sess, mask, qs_py1, dur)

        # ── ИВТ-23: test_web + test_db
        qs_web = questions_web_html + questions_web_js

        web_patterns = {
            sts_23[0]: ([True,True,True,True,False,False], 1100),  # 4/6
            sts_23[1]: ([True,True,True,True,True,False], 1300),   # 5/6
            sts_23[2]: ([True,False,True,False,False,False], 700), # 2/6 — слабый
            sts_23[3]: ([True,True,True,True,True,True], 1500),    # 6/6 — отлично
        }
        db23_patterns = {
            sts_23[0]: ([True,True,True,False,False,False,False,False,False], 1600),  # 3/9
            sts_23[1]: ([True,True,True,True,False,False,True,False,False], 2000),    # 5/9
            sts_23[2]: ([True,False,True,False,False,False,False,False,False], 1200), # 2/9
            sts_23[3]: ([True,True,True,True,True,False,True,False,True], 2400),      # 7/9
        }

        sessions_web23 = []
        sessions_db23  = []
        base_date_23 = datetime(2026, 3, 25, 9, 0, tzinfo=OMSK)

        for j, st in enumerate(sts_23):
            started_web = base_date_23 + timedelta(days=j % 2)
            started_db3 = base_date_23 + timedelta(days=4 + j % 2)
            mask_w, dur_w = web_patterns[st]
            mask_d, dur_d = db23_patterns[st]

            sess_w = TestSession(test_id=test_web.id, student_id=st.id, attempt_number=1,
                status=SessionStatus.completed,
                started_at=started_web, finished_at=started_web+timedelta(seconds=dur_w),
                score_total=float(sum(mask_w)), score_max=float(len(qs_web)),
                passed=(sum(mask_w)/len(qs_web)*100) >= float(test_web.passing_score_pct))
            sess_d = TestSession(test_id=test_db.id, student_id=st.id, attempt_number=1,
                status=SessionStatus.completed,
                started_at=started_db3, finished_at=started_db3+timedelta(seconds=dur_d),
                score_total=float(sum(mask_d)), score_max=float(len(qs_db)),
                passed=(sum(mask_d)/len(qs_db)*100) >= float(test_db.passing_score_pct))
            sessions_web23.append((sess_w, mask_w, dur_w))
            sessions_db23.append((sess_d, mask_d, dur_d))

        sess_objs_23 = [s for s,_,_ in sessions_web23] + [s for s,_,_ in sessions_db23]
        db.add_all(sess_objs_23)
        await db.flush()

        for (sess, mask, dur) in sessions_web23:
            make_answers(sess, mask, qs_web, dur)
        for (sess, mask, dur) in sessions_db23:
            make_answers(sess, mask, qs_db, dur)

        # ── МАТ-21: test_math (9 вопросов)
        qs_math = questions_math_lim + questions_math_deriv + questions_math_integ

        math_patterns = {
            sts_m21[0]: ([True,True,False,True,True,False,True,False,False], 2700),  # 5/9, 45 мин
            sts_m21[1]: ([True,True,True,True,True,True,False,False,False], 2400),   # 6/9, 40 мин
            sts_m21[2]: ([True,False,False,True,False,False,False,False,False], 1800),# 2/9, 30 мин — слабый
            sts_m21[3]: ([True,True,False,True,True,False,True,True,False], 3000),   # 6/9, 50 мин
            sts_m21[4]: ([True,True,True,True,True,True,True,True,True], 3300),      # 9/9, 55 мин — отличник
        }

        sessions_math = []
        base_date_m = datetime(2026, 3, 28, 10, 0, tzinfo=OMSK)

        for j, st in enumerate(sts_m21):
            started = base_date_m + timedelta(days=j % 3, hours=j // 3)
            mask, dur = math_patterns[st]
            sess = TestSession(test_id=test_math.id, student_id=st.id, attempt_number=1,
                status=SessionStatus.completed,
                started_at=started, finished_at=started+timedelta(seconds=dur),
                score_total=float(sum(mask)), score_max=float(len(qs_math)),
                passed=(sum(mask)/len(qs_math)*100) >= float(test_math.passing_score_pct))
            sessions_math.append((sess, mask, dur))

        db.add_all([s for s,_,_ in sessions_math])
        await db.flush()

        for (sess, mask, dur) in sessions_math:
            make_answers(sess, mask, qs_math, dur)

        db.add_all(answers_all)
        await db.flush()

        # ── 14. Расписание ──────────────────────────────────────────
        def ldt(d_offset, h, mi=0):
            base = date(2026, 4, 14)
            d = base + timedelta(days=d_offset)
            return datetime(d.year, d.month, d.day, h, mi, tzinfo=OMSK)

        lessons = []
        # Python / ИВТ-21 — пн+чт (8:30–10:05)
        for i, (off, topic) in enumerate([
            (-21, "Введение. Типы данных Python"),
            (-18, "Управляющие конструкции. Функции"),
            (-14, "Коллекции: list, dict, set"),
            (-11, "ООП: классы, наследование"),
            (-7,  "Исключения. Модули"),
            (-4,  "Файлы и JSON"),
            (1,   "Декораторы и генераторы"),
            (4,   "Асинхронное программирование"),
        ]):
            lessons.append(Lesson(assignment_id=ta_py21.id,
                starts_at=ldt(off, 8, 30), ends_at=ldt(off, 10, 5),
                topic=topic, room="А-205",
                lesson_type=LessonType.lecture if i % 2 == 0 else LessonType.practice))
        # Python / ИВТ-22 — вт (10:20–11:55)
        for i, (off, topic) in enumerate([
            (-20, "Введение в Python"),
            (-13, "Коллекции и итераторы"),
            (-6,  "ООП: классы"),
            (2,   "Исключения и файлы"),
        ]):
            lessons.append(Lesson(assignment_id=ta_py22.id,
                starts_at=ldt(off, 10, 20), ends_at=ldt(off, 11, 55),
                topic=topic, room="А-205",
                lesson_type=LessonType.lecture if i % 2 == 0 else LessonType.practice))
        # БД / ИВТ-22 — пт (10:20–11:55)
        for i, (off, topic) in enumerate([
            (-19, "Реляционная модель"),
            (-12, "SQL DDL: создание таблиц"),
            (-5,  "SQL DML: SELECT, INSERT"),
            (3,   "JOIN и подзапросы"),
            (7,   "Индексы и оптимизация"),
        ]):
            lessons.append(Lesson(assignment_id=ta_db22.id,
                starts_at=ldt(off, 10, 20), ends_at=ldt(off, 11, 55),
                topic=topic, room="Б-112",
                lesson_type=LessonType.lecture if i % 2 == 0 else LessonType.practice))
        # Веб / ИВТ-23 — вт (12:10–13:45)
        for i, (off, topic) in enumerate([
            (-17, "HTML: структура документа"),
            (-10, "CSS: стили и flexbox"),
            (-3,  "JavaScript: основы"),
            (4,   "DOM и события"),
        ]):
            lessons.append(Lesson(assignment_id=ta_web23.id,
                starts_at=ldt(off, 12, 10), ends_at=ldt(off, 13, 45),
                topic=topic, room="В-301",
                lesson_type=LessonType.lecture if i % 2 == 0 else LessonType.practice))
        # БД / ИВТ-23 — пт (12:10–13:45)
        for i, (off, topic) in enumerate([
            (-16, "Реляционная модель и SQL"),
            (-9,  "JOIN-запросы"),
            (-2,  "Транзакции и ACID"),
            (5,   "Нормализация"),
        ]):
            lessons.append(Lesson(assignment_id=ta_db23.id,
                starts_at=ldt(off, 12, 10), ends_at=ldt(off, 13, 45),
                topic=topic, room="Б-112",
                lesson_type=LessonType.lecture if i % 2 == 0 else LessonType.practice))
        # Матан / МАТ-21 — ср+сб (14:00–15:35)
        for i, (off, topic) in enumerate([
            (-19, "Пределы функций: определение"),
            (-15, "Замечательные пределы"),
            (-12, "Производная: определение"),
            (-8,  "Правила дифференцирования"),
            (-5,  "Дифференциал и применение"),
            (-1,  "Неопределённый интеграл"),
            (3,   "Методы интегрирования"),
            (6,   "Определённый интеграл"),
        ]):
            lessons.append(Lesson(assignment_id=ta_math.id,
                starts_at=ldt(off, 14, 0), ends_at=ldt(off, 15, 35),
                topic=topic, room="В-301",
                lesson_type=LessonType.seminar if i >= 4 else LessonType.lecture))

        db.add_all(lessons)
        await db.flush()

        # ── 15. Посещаемость ────────────────────────────────────────
        att_records = []

        def add_att(past_lessons, students, ta_id, t_id, presence_matrix):
            for lesson, row in zip(past_lessons, presence_matrix):
                lesson_date = lesson.starts_at.date()
                for student, present in zip(students, row):
                    att_records.append(Attendance(
                        student_id=student.id, assignment_id=ta_id,
                        lesson_date=lesson_date, is_present=present,
                        comment=None if present else "Отсутствовал",
                        recorded_by=t_id,
                    ))

        py21_lessons_past = [l for l in lessons[:8] if l.starts_at.date() < date(2026, 4, 14)]
        py22_lessons_past = [l for l in lessons[8:12] if l.starts_at.date() < date(2026, 4, 14)]
        db22_lessons_past = [l for l in lessons[12:17] if l.starts_at.date() < date(2026, 4, 14)]
        web23_lessons_past= [l for l in lessons[17:21] if l.starts_at.date() < date(2026, 4, 14)]
        db23_lessons_past = [l for l in lessons[21:25] if l.starts_at.date() < date(2026, 4, 14)]
        math_lessons_past = [l for l in lessons[25:33] if l.starts_at.date() < date(2026, 4, 14)]

        # ИВТ-21: 6 студентов, матрица присутствий
        add_att(py21_lessons_past, sts_21, ta_py21.id, t1.id, [
            [True,  True,  True,  True,  True,  True ],
            [True,  True,  False, True,  True,  True ],
            [True,  False, True,  True,  True,  True ],
            [True,  True,  True,  True,  False, True ],
            [True,  True,  True,  True,  True,  False],
            [False, True,  True,  True,  True,  True ],
        ])
        # ИВТ-22 по Python
        add_att(py22_lessons_past, sts_22, ta_py22.id, t1.id, [
            [True, True, True, True, True],
            [True, True, True, False, True],
            [True, True, True, True, True],
        ])
        # ИВТ-22 по БД
        add_att(db22_lessons_past, sts_22, ta_db22.id, t1.id, [
            [True, True, True, True, True],
            [True, True, False, True, True],
            [True, True, True, True, False],
            [True, False, True, True, True],
        ])
        # ИВТ-23 по Веб
        add_att(web23_lessons_past, sts_23, ta_web23.id, t3.id, [
            [True, True, True, True],
            [True, False, True, True],
            [True, True, True, True],
        ])
        # ИВТ-23 по БД
        add_att(db23_lessons_past, sts_23, ta_db23.id, t3.id, [
            [True, True, True, True],
            [True, True, True, False],
            [True, True, True, True],
        ])
        # МАТ-21
        add_att(math_lessons_past, sts_m21, ta_math.id, t2.id, [
            [True,  True,  True,  True,  True ],
            [True,  False, True,  True,  True ],
            [True,  True,  True,  False, True ],
            [True,  True,  True,  True,  True ],
            [False, True,  True,  True,  True ],
            [True,  True,  False, True,  True ],
        ])

        db.add_all(att_records)
        await db.flush()

        # ── 16. Оценки ──────────────────────────────────────────────
        grade_records = []

        def add_grades(students, t_id, ta_id, grade_data):
            for st, entries in zip(students, grade_data):
                for gtype, val, passed, d, comment in entries:
                    grade_records.append(Grade(
                        student_id=st.id, assignment_id=ta_id,
                        grade_type=gtype, value=val, passed=passed,
                        comment=comment, date_recorded=d, recorded_by=t_id,
                    ))

        add_grades(sts_21, t1.id, ta_py21.id, [
            [(GradeType.current, 5.0, True, date(2026,3,24), None),
             (GradeType.thematic,5.0, True, date(2026,4,3),  "Тема 1 — отлично")],
            [(GradeType.current, 5.0, True, date(2026,3,24), None),
             (GradeType.thematic,5.0, True, date(2026,4,3),  None)],
            [(GradeType.current, 3.0, True, date(2026,3,24), "Слабо"),
             (GradeType.thematic,3.0, True, date(2026,4,3),  "Нужно доработать")],
            [(GradeType.current, 4.0, True, date(2026,3,24), None),
             (GradeType.thematic,4.0, True, date(2026,4,3),  None)],
            [(GradeType.current, 2.0, False,date(2026,3,24), "Не выполнил задание"),
             (GradeType.thematic,3.0, True, date(2026,4,3),  "Исправился")],
            [(GradeType.current, 4.0, True, date(2026,3,24), None),
             (GradeType.thematic,4.0, True, date(2026,4,3),  None)],
        ])

        add_grades(sts_22, t1.id, ta_db22.id, [
            [(GradeType.current, 4.0, True, date(2026,3,25), None),
             (GradeType.thematic,4.0, True, date(2026,4,7),  None)],
            [(GradeType.current, 5.0, True, date(2026,3,25), None),
             (GradeType.thematic,5.0, True, date(2026,4,7),  "Отлично")],
            [(GradeType.current, 3.0, True, date(2026,3,25), "Пропустил лекцию"),
             (GradeType.thematic,3.0, True, date(2026,4,7),  None)],
            [(GradeType.current, 5.0, True, date(2026,3,25), None),
             (GradeType.thematic,5.0, True, date(2026,4,7),  None)],
            [(GradeType.current, 5.0, True, date(2026,3,25), None),
             (GradeType.thematic,5.0, True, date(2026,4,7),  "Лучший результат в группе")],
        ])

        add_grades(sts_23, t3.id, ta_web23.id, [
            [(GradeType.current, 4.0, True, date(2026,3,28), None)],
            [(GradeType.current, 4.0, True, date(2026,3,28), None)],
            [(GradeType.current, 3.0, True, date(2026,3,28), "Слабая работа на практике")],
            [(GradeType.current, 5.0, True, date(2026,3,28), None)],
        ])

        add_grades(sts_m21, t2.id, ta_math.id, [
            [(GradeType.current, 4.0, True, date(2026,3,26), None),
             (GradeType.midterm, 4.0, True, date(2026,4,8),  "Рубежный контроль")],
            [(GradeType.current, 4.0, True, date(2026,3,26), None),
             (GradeType.midterm, 5.0, True, date(2026,4,8),  None)],
            [(GradeType.current, 3.0, True, date(2026,3,26), "Затруднения с пределами"),
             (GradeType.midterm, 2.0, False,date(2026,4,8),  "Не справился с вариантом")],
            [(GradeType.current, 4.0, True, date(2026,3,26), None),
             (GradeType.midterm, 4.0, True, date(2026,4,8),  None)],
            [(GradeType.current, 5.0, True, date(2026,3,26), None),
             (GradeType.midterm, 5.0, True, date(2026,4,8),  "Абсолютный результат")],
        ])

        db.add_all(grade_records)
        await db.commit()

        # ── Итог ────────────────────────────────────────────────────
        print("\nOK: База данных полностью заполнена!\n")
        print("  Аккаунты:")
        print("    admin@demo.ru       / admin1234    — Администратор")
        print("    ivanov@demo.ru      / teacher1234  — Иванов А.П. (Python, БД)")
        print("    smirnova@demo.ru    / teacher1234  — Смирнова Е.В. (Математика)")
        print("    petrov@demo.ru      / teacher1234  — Петрова О.И. (Веб, БД)")
        print("    s1_ivt21@demo.ru    / student1234  — Александров И.С. (ИВТ-21)")
        print("    s1_mat21@demo.ru    / student1234  — Сорокин М.Ф. (МАТ-21)")
        print()
        print("  Группы:    ИВТ-21 (6 чел.), ИВТ-22 (5 чел.), ИВТ-23 (4 чел.), МАТ-21 (5 чел.)")
        print("  Предметы:  Python, Базы данных, Веб-разработка, Высшая математика")
        print("  Тесты:     5 тестов, 33 вопроса, 36 тем")
        print(f"  Сессии:    {len(sessions_all) + len(sessions_py2) + len(sess_objs_22) + len(sess_objs_23) + len(sessions_math)} завершённых")
        print(f"  Ответы:    {len(answers_all)} записей")
        print(f"  Занятий:   {len(lessons)}")
        print(f"  Посещаемость: {len(att_records)} записей")
        print(f"  Оценки:    {len(grade_records)} записей")


async def main():
    await reset_db()
    await seed()

if __name__ == "__main__":
    asyncio.run(main())
