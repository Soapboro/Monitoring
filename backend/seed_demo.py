"""
Демо-данные: администратор создаёт расписание,
преподаватель отмечает посещаемость и выставляет оценки.
"""
import asyncio
from datetime import datetime, date, timedelta, timezone

OMSK = timezone(timedelta(hours=6))  # UTC+6, Asia/Omsk

from app.database import AsyncSessionLocal, engine, Base
from app.models import (
    User, UserRole,
    Department, Group,
    Teacher, Student,
    Subject, TeachingAssignment,
    Lesson, LessonType,
    Attendance, Grade, GradeType,
)
from app.security import hash_password


# ──────────────────────────── helpers ────────────────────────────

def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def dt(y, mo, d, h=0, mi=0) -> datetime:
    return datetime(y, mo, d, h, mi, tzinfo=OMSK)


# ──────────────────────────── main ───────────────────────────────

async def seed():
    async with AsyncSessionLocal() as db:

        # ── 1. Кафедры ──────────────────────────────────────────
        dep_cs = Department(
            name="Кафедра информатики и вычислительной техники",
            code="ИВТ",
            description="Подготовка специалистов в области ИТ",
        )
        dep_math = Department(
            name="Кафедра математики",
            code="МАТ",
            description="Фундаментальная математика и прикладной анализ",
        )
        db.add_all([dep_cs, dep_math])
        await db.flush()

        # ── 2. Группы ────────────────────────────────────────────
        g_ivt21 = Group(name="ИВТ-21", year_start=2021, department_id=dep_cs.id, is_active=True)
        g_ivt22 = Group(name="ИВТ-22", year_start=2022, department_id=dep_cs.id, is_active=True)
        g_mat21 = Group(name="МАТ-21", year_start=2021, department_id=dep_math.id, is_active=True)
        db.add_all([g_ivt21, g_ivt22, g_mat21])
        await db.flush()

        # ── 3. Пользователи ─────────────────────────────────────
        u_admin = User(
            email="admin@demo.ru",
            password_hash=hash_password("admin1234"),
            role=UserRole.admin,
        )
        u_teacher1 = User(
            email="ivanov@demo.ru",
            password_hash=hash_password("teacher1234"),
            role=UserRole.teacher,
        )
        u_teacher2 = User(
            email="smirnova@demo.ru",
            password_hash=hash_password("teacher1234"),
            role=UserRole.teacher,
        )
        # студенты ИВТ-21
        student_users_ivt21 = [
            User(email=f"s{i}_ivt21@demo.ru", password_hash=hash_password("student1234"), role=UserRole.student)
            for i in range(1, 6)
        ]
        # студенты ИВТ-22
        student_users_ivt22 = [
            User(email=f"s{i}_ivt22@demo.ru", password_hash=hash_password("student1234"), role=UserRole.student)
            for i in range(1, 5)
        ]
        # студенты МАТ-21
        student_users_mat21 = [
            User(email=f"s{i}_mat21@demo.ru", password_hash=hash_password("student1234"), role=UserRole.student)
            for i in range(1, 5)
        ]
        all_users = (
            [u_admin, u_teacher1, u_teacher2]
            + student_users_ivt21
            + student_users_ivt22
            + student_users_mat21
        )
        db.add_all(all_users)
        await db.flush()

        # ── 4. Профили преподавателей ────────────────────────────
        t1 = Teacher(
            user_id=u_teacher1.id,
            last_name="Иванов", first_name="Александр", middle_name="Петрович",
            position="Доцент", department_id=dep_cs.id,
            phone="+7-900-111-22-33",
        )
        t2 = Teacher(
            user_id=u_teacher2.id,
            last_name="Смирнова", first_name="Елена", middle_name="Васильевна",
            position="Старший преподаватель", department_id=dep_math.id,
            phone="+7-900-444-55-66",
        )
        db.add_all([t1, t2])
        await db.flush()

        # ── 5. Профили студентов ─────────────────────────────────
        student_meta_ivt21 = [
            ("Петров",    "Иван",       "Сергеевич",  date(2003, 3, 15), "2021001"),
            ("Кузнецова", "Мария",      "Андреевна",  date(2003, 7, 22), "2021002"),
            ("Сидоров",   "Артём",      "Олегович",   date(2003, 1, 10), "2021003"),
            ("Новикова",  "Анастасия",  "Ивановна",   date(2002, 11, 5), "2021004"),
            ("Морозов",   "Дмитрий",    "Николаевич", date(2003, 5, 30), "2021005"),
        ]
        student_meta_ivt22 = [
            ("Волков",    "Никита",  "Алексеевич", date(2004, 2, 18), "2022001"),
            ("Лебедева",  "София",   "Павловна",   date(2004, 8, 9),  "2022002"),
            ("Козлов",    "Антон",   "Вячеславович", date(2004, 4, 3), "2022003"),
            ("Попова",    "Виктория","Денисовна",  date(2004, 6, 25), "2022004"),
        ]
        student_meta_mat21 = [
            ("Фёдоров",   "Михаил",  "Тимурович",  date(2003, 9, 12), "2021101"),
            ("Орлова",    "Дарья",   "Романовна",  date(2003, 12, 1), "2021102"),
            ("Зайцев",    "Кирилл",  "Игоревич",   date(2002, 10, 7), "2021103"),
            ("Соколова",  "Полина",  "Евгеньевна", date(2003, 4, 19), "2021104"),
        ]

        def make_students(users, meta, group_id):
            return [
                Student(
                    user_id=u.id,
                    last_name=m[0], first_name=m[1], middle_name=m[2],
                    birth_date=m[3], group_id=group_id,
                    student_num=m[4], is_active=True,
                )
                for u, m in zip(users, meta)
            ]

        sts_ivt21 = make_students(student_users_ivt21, student_meta_ivt21, g_ivt21.id)
        sts_ivt22 = make_students(student_users_ivt22, student_meta_ivt22, g_ivt22.id)
        sts_mat21 = make_students(student_users_mat21, student_meta_mat21, g_mat21.id)
        all_students = sts_ivt21 + sts_ivt22 + sts_mat21
        db.add_all(all_students)
        await db.flush()

        # ── 6. Дисциплины ────────────────────────────────────────
        subj_py   = Subject(name="Программирование на Python",  code="CS101", hours_total=72, department_id=dep_cs.id)
        subj_db   = Subject(name="Базы данных",                 code="CS201", hours_total=54, department_id=dep_cs.id)
        subj_math = Subject(name="Высшая математика",           code="MA101", hours_total=108, department_id=dep_math.id)
        db.add_all([subj_py, subj_db, subj_math])
        await db.flush()

        # ── 7. Привязки преподаватель→предмет→группа ─────────────
        ta_py_ivt21 = TeachingAssignment(
            teacher_id=t1.id, subject_id=subj_py.id, group_id=g_ivt21.id,
            semester=6, acad_year="2024-2025",
        )
        ta_db_ivt22 = TeachingAssignment(
            teacher_id=t1.id, subject_id=subj_db.id, group_id=g_ivt22.id,
            semester=4, acad_year="2024-2025",
        )
        ta_math_mat21 = TeachingAssignment(
            teacher_id=t2.id, subject_id=subj_math.id, group_id=g_mat21.id,
            semester=6, acad_year="2024-2025",
        )
        db.add_all([ta_py_ivt21, ta_db_ivt22, ta_math_mat21])
        await db.flush()

        # ── 8. Расписание (создаёт администратор) ────────────────
        # Опорная дата: прошедшие занятия — 2 недели назад, будущие — вперёд
        today = date(2026, 4, 13)

        def lesson_dt(d: date, h: int, mi: int = 0) -> datetime:
            return datetime(d.year, d.month, d.day, h, mi, tzinfo=OMSK)

        # --- Python / ИВТ-21  (понедельник + четверг) ---
        py_lessons_dates = [
            today - timedelta(days=21),  # прошедшее
            today - timedelta(days=18),  # прошедшее
            today - timedelta(days=14),  # прошедшее
            today - timedelta(days=11),  # прошедшее
            today - timedelta(days=7),   # прошедшее
            today - timedelta(days=4),   # прошедшее
            today + timedelta(days=1),   # будущее
            today + timedelta(days=4),   # будущее
        ]
        py_topics = [
            "Введение в Python. Типы данных",
            "Управляющие конструкции. Функции",
            "Коллекции: список, кортеж, словарь",
            "ООП: классы и объекты",
            "Исключения. Модули и пакеты",
            "Работа с файлами и JSON",
            "Декораторы и генераторы",
            "Асинхронное программирование",
        ]
        py_lessons = [
            Lesson(
                assignment_id=ta_py_ivt21.id,
                starts_at=lesson_dt(d, 8, 30),
                ends_at=lesson_dt(d, 10, 5),
                topic=topic,
                lesson_type=LessonType.lecture if i % 2 == 0 else LessonType.practice,
                room="А-205",
            )
            for i, (d, topic) in enumerate(zip(py_lessons_dates, py_topics))
        ]

        # --- БД / ИВТ-22  (вторник + пятница) ---
        db_lessons_dates = [
            today - timedelta(days=20),
            today - timedelta(days=16),
            today - timedelta(days=13),
            today - timedelta(days=9),
            today - timedelta(days=6),
            today - timedelta(days=2),
            today + timedelta(days=2),
            today + timedelta(days=5),
        ]
        db_topics = [
            "Реляционная модель данных",
            "SQL: DDL — создание таблиц",
            "SQL: DML — выборки, вставка",
            "SQL: JOIN и подзапросы",
            "Транзакции и ACID",
            "Индексы и оптимизация",
            "Нормализация БД",
            "NoSQL базы данных",
        ]
        db_lessons = [
            Lesson(
                assignment_id=ta_db_ivt22.id,
                starts_at=lesson_dt(d, 10, 20),
                ends_at=lesson_dt(d, 11, 55),
                topic=topic,
                lesson_type=LessonType.lecture if i % 2 == 0 else LessonType.practice,
                room="Б-112",
            )
            for i, (d, topic) in enumerate(zip(db_lessons_dates, db_topics))
        ]

        # --- Высшая математика / МАТ-21  (среда + суббота) ---
        math_lessons_dates = [
            today - timedelta(days=19),
            today - timedelta(days=15),
            today - timedelta(days=12),
            today - timedelta(days=8),
            today - timedelta(days=5),
            today - timedelta(days=1),
            today + timedelta(days=3),
            today + timedelta(days=6),
        ]
        math_topics = [
            "Пределы функций",
            "Производная: определение и правила",
            "Дифференциал и его применение",
            "Интеграл Римана",
            "Методы интегрирования",
            "Дифференциальные уравнения",
            "Ряды Тейлора",
            "Числовые ряды",
        ]
        math_lessons = [
            Lesson(
                assignment_id=ta_math_mat21.id,
                starts_at=lesson_dt(d, 12, 10),
                ends_at=lesson_dt(d, 13, 45),
                topic=topic,
                lesson_type=LessonType.lecture if i < 4 else LessonType.seminar,
                room="В-301",
            )
            for i, (d, topic) in enumerate(zip(math_lessons_dates, math_topics))
        ]

        all_lessons = py_lessons + db_lessons + math_lessons
        db.add_all(all_lessons)
        await db.flush()

        # ── 9. Посещаемость (преподаватель отмечает) ─────────────
        # Отмечаем только прошедшие занятия (первые 6 в каждом списке)
        past_py    = py_lessons[:6]
        past_db    = db_lessons[:6]
        past_math  = math_lessons[:6]

        # is_present матрица: True/False для каждого студента
        # ИВТ-21: 5 студентов
        presence_py = [
            [True,  True,  True,  True,  True],
            [True,  True,  False, True,  True],
            [True,  False, True,  True,  True],
            [True,  True,  True,  False, True],
            [True,  True,  True,  True,  False],
            [True,  True,  True,  True,  True],
        ]
        # ИВТ-22: 4 студента
        presence_db = [
            [True,  True,  True,  True],
            [True,  True,  True,  True],
            [False, True,  True,  True],
            [True,  True,  False, True],
            [True,  True,  True,  False],
            [True,  True,  True,  True],
        ]
        # МАТ-21: 4 студента
        presence_math = [
            [True,  True,  True,  True],
            [True,  False, True,  True],
            [True,  True,  True,  False],
            [True,  True,  True,  True],
            [False, True,  True,  True],
            [True,  True,  True,  True],
        ]

        attendance_records = []

        def add_attendance(lessons, students, teacher, assignment_id, presence_matrix):
            for lesson, row in zip(lessons, presence_matrix):
                lesson_date = lesson.starts_at.date()
                for student, present in zip(students, row):
                    attendance_records.append(
                        Attendance(
                            student_id=student.id,
                            assignment_id=assignment_id,
                            lesson_date=lesson_date,
                            is_present=present,
                            comment=None if present else "Не явился без объяснения причин",
                            recorded_by=teacher.id,
                        )
                    )

        add_attendance(past_py,   sts_ivt21, t1, ta_py_ivt21.id,   presence_py)
        add_attendance(past_db,   sts_ivt22, t1, ta_db_ivt22.id,   presence_db)
        add_attendance(past_math, sts_mat21, t2, ta_math_mat21.id, presence_math)

        db.add_all(attendance_records)
        await db.flush()

        # ── 10. Оценки (преподаватель выставляет) ────────────────
        grades_records = []

        def add_grades(students, teacher, assignment_id, grade_data):
            """grade_data: список (grade_type, value, passed, date_recorded, comment)"""
            for student, entries in zip(students, grade_data):
                for gtype, val, passed, d, comment in entries:
                    grades_records.append(
                        Grade(
                            student_id=student.id,
                            assignment_id=assignment_id,
                            grade_type=gtype,
                            value=val,
                            passed=passed,
                            comment=comment,
                            date_recorded=d,
                            recorded_by=teacher.id,
                        )
                    )

        # Оценки по Python (ИВТ-21)
        py_grade_data = [
            # Петров
            [(GradeType.current, 5.0, True,  date(2026, 3, 24), "Отлично"),
             (GradeType.current, 4.0, True,  date(2026, 4, 3),  None),
             (GradeType.thematic, 5.0, True, date(2026, 4, 6),  "Тема 1 зачтена")],
            # Кузнецова
            [(GradeType.current, 5.0, True,  date(2026, 3, 24), None),
             (GradeType.current, 5.0, True,  date(2026, 4, 3),  None),
             (GradeType.thematic, 5.0, True, date(2026, 4, 6),  None)],
            # Сидоров
            [(GradeType.current, 3.0, True,  date(2026, 3, 24), "Слабо"),
             (GradeType.current, 4.0, True,  date(2026, 4, 3),  None),
             (GradeType.thematic, 3.0, True, date(2026, 4, 6),  "Нужно доработать")],
            # Новикова
            [(GradeType.current, 4.0, True,  date(2026, 3, 24), None),
             (GradeType.current, 4.0, True,  date(2026, 4, 3),  None),
             (GradeType.thematic, 4.0, True, date(2026, 4, 6),  None)],
            # Морозов
            [(GradeType.current, 2.0, False, date(2026, 3, 24), "Не выполнил задание"),
             (GradeType.current, 3.0, True,  date(2026, 4, 3),  "Исправился"),
             (GradeType.thematic, 3.0, True, date(2026, 4, 6),  None)],
        ]
        add_grades(sts_ivt21, t1, ta_py_ivt21.id, py_grade_data)

        # Оценки по БД (ИВТ-22)
        db_grade_data = [
            # Волков
            [(GradeType.current, 5.0, True,  date(2026, 3, 25), None),
             (GradeType.thematic, 5.0, True, date(2026, 4, 7),  "Тема 1 отлично")],
            # Лебедева
            [(GradeType.current, 4.0, True,  date(2026, 3, 25), None),
             (GradeType.thematic, 4.0, True, date(2026, 4, 7),  None)],
            # Козлов
            [(GradeType.current, 3.0, True,  date(2026, 3, 25), "Пропустил лекцию"),
             (GradeType.thematic, 3.0, True, date(2026, 4, 7),  None)],
            # Попова
            [(GradeType.current, 5.0, True,  date(2026, 3, 25), None),
             (GradeType.thematic, 5.0, True, date(2026, 4, 7),  None)],
        ]
        add_grades(sts_ivt22, t1, ta_db_ivt22.id, db_grade_data)

        # Оценки по Высшей математике (МАТ-21)
        math_grade_data = [
            # Фёдоров
            [(GradeType.current, 4.0, True,  date(2026, 3, 26), None),
             (GradeType.midterm, 4.0, True,  date(2026, 4, 8),  "Рубежная контрольная")],
            # Орлова
            [(GradeType.current, 5.0, True,  date(2026, 3, 26), None),
             (GradeType.midterm, 5.0, True,  date(2026, 4, 8),  None)],
            # Зайцев
            [(GradeType.current, 3.0, True,  date(2026, 3, 26), "Сложности с пределами"),
             (GradeType.midterm, 3.0, True,  date(2026, 4, 8),  None)],
            # Соколова
            [(GradeType.current, 4.0, True,  date(2026, 3, 26), None),
             (GradeType.midterm, 4.0, True,  date(2026, 4, 8),  None)],
        ]
        add_grades(sts_mat21, t2, ta_math_mat21.id, math_grade_data)

        db.add_all(grades_records)
        await db.commit()

        # ── Итог ─────────────────────────────────────────────────
        print("OK: Demo-dannye uspeshno zagruzheny!")
        print()
        print("  Аккаунты:")
        print("    Администратор : admin@demo.ru     / admin1234")
        print("    Преподаватель : ivanov@demo.ru    / teacher1234  (Иванов А.П.)")
        print("    Преподаватель : smirnova@demo.ru  / teacher1234  (Смирнова Е.В.)")
        print("    Студенты      : s1_ivt21@demo.ru  / student1234  ... и т.д.")
        print()
        print("  Группы    : ИВТ-21 (5 чел.), ИВТ-22 (4 чел.), МАТ-21 (4 чел.)")
        print("  Предметы  : Python, Базы данных, Высшая математика")
        print(f"  Занятий   : {len(all_lessons)} (по 6 прошедших + 2 будущих в каждом курсе)")
        print(f"  Посещаемость: {len(attendance_records)} записей")
        print(f"  Оценки    : {len(grades_records)} записей")


if __name__ == "__main__":
    asyncio.run(seed())
