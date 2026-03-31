-- ============================================================
-- Сэмплы данных: Система мониторинга успеваемости
-- Применять ПОСЛЕ schema_postgres.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ПОЛЬЗОВАТЕЛИ
-- Пароль для всех: "Password123" > bcrypt-хэш (заглушка для демо)
-- ============================================================

INSERT INTO users (id, email, password_hash, role) VALUES
-- Администраторы
(1,  'admin@college.ru',           '$2b$12$demo_admin_hash_placeholder_1', 'admin'),
-- Преподаватели
(2,  'anatolev@college.ru',        '$2b$12$demo_teacher_hash_placeholder1', 'teacher'),
(3,  'kuznetsova@college.ru',      '$2b$12$demo_teacher_hash_placeholder2', 'teacher'),
(4,  'morozov@college.ru',         '$2b$12$demo_teacher_hash_placeholder3', 'teacher'),
(5,  'sorokina@college.ru',        '$2b$12$demo_teacher_hash_placeholder4', 'teacher'),
-- Студенты группы ЗИВТ-211 (10 чел.)
(6,  'petrov.s@students.college.ru',    '$2b$12$demo_student_hash_00001', 'student'),
(7,  'sidorova.m@students.college.ru',  '$2b$12$demo_student_hash_00002', 'student'),
(8,  'voronov.d@students.college.ru',   '$2b$12$demo_student_hash_00003', 'student'),
(9,  'lebedeva.a@students.college.ru',  '$2b$12$demo_student_hash_00004', 'student'),
(10, 'kozlov.i@students.college.ru',    '$2b$12$demo_student_hash_00005', 'student'),
(11, 'novikova.e@students.college.ru',  '$2b$12$demo_student_hash_00006', 'student'),
(12, 'fedorov.n@students.college.ru',   '$2b$12$demo_student_hash_00007', 'student'),
(13, 'zaitseva.o@students.college.ru',  '$2b$12$demo_student_hash_00008', 'student'),
(14, 'sokolov.k@students.college.ru',   '$2b$12$demo_student_hash_00009', 'student'),
(15, 'mihailova.v@students.college.ru', '$2b$12$demo_student_hash_00010', 'student'),
-- Студенты группы ЗИВТ-221 (8 чел.)
(16, 'alekseev.r@students.college.ru',  '$2b$12$demo_student_hash_00011', 'student'),
(17, 'stepanova.l@students.college.ru', '$2b$12$demo_student_hash_00012', 'student'),
(18, 'dmitriev.a@students.college.ru',  '$2b$12$demo_student_hash_00013', 'student'),
(19, 'ivanova.n@students.college.ru',   '$2b$12$demo_student_hash_00014', 'student'),
(20, 'semenov.v@students.college.ru',   '$2b$12$demo_student_hash_00015', 'student'),
(21, 'grigorieva.t@students.college.ru','$2b$12$demo_student_hash_00016', 'student'),
(22, 'nikitin.p@students.college.ru',   '$2b$12$demo_student_hash_00017', 'student'),
(23, 'popova.yu@students.college.ru',   '$2b$12$demo_student_hash_00018', 'student');

SELECT setval('users_id_seq', 23);

-- ============================================================
-- 2. КАФЕДРЫ
-- ============================================================

INSERT INTO departments (id, name, code, description) VALUES
(1, 'Автоматизированные системы обработки информации и управления', 'АСОИУ',
   'Подготовка специалистов в области разработки и сопровождения информационных систем'),
(2, 'Математика и информатика', 'МиИ',
   'Фундаментальная математическая и информационная подготовка');

SELECT setval('departments_id_seq', 2);

-- ============================================================
-- 3. ГРУППЫ
-- ============================================================

INSERT INTO groups (id, name, year_start, department_id) VALUES
(1, 'ЗИВТ-211', 2021, 1),
(2, 'ЗИВТ-221', 2022, 1),
(3, 'ЗМАТ-211', 2021, 2);

SELECT setval('groups_id_seq', 3);

-- ============================================================
-- 4. ПРЕПОДАВАТЕЛИ
-- ============================================================

INSERT INTO teachers (id, user_id, last_name, first_name, middle_name, position, phone) VALUES
(1, 2, 'Анатольев',  'Александр', 'Геннадьевич', 'старший преподаватель', '+7-913-555-01-01'),
(2, 3, 'Кузнецова',  'Ирина',     'Петровна',    'доцент, к.т.н.',        '+7-913-555-01-02'),
(3, 4, 'Морозов',    'Виктор',    'Сергеевич',   'доцент, к.т.н.',        '+7-913-555-01-03'),
(4, 5, 'Сорокина',   'Наталья',   'Андреевна',   'старший преподаватель', '+7-913-555-01-04');

SELECT setval('teachers_id_seq', 4);

-- ============================================================
-- 5. СТУДЕНТЫ
-- ============================================================

-- Группа ЗИВТ-211
INSERT INTO students (id, user_id, last_name, first_name, middle_name, birth_date, group_id, student_num) VALUES
(1,  6,  'Петров',    'Сергей',    'Иванович',    '2003-04-12', 1, 'ЗИТ-2021-001'),
(2,  7,  'Сидорова',  'Мария',     'Алексеевна',  '2003-07-25', 1, 'ЗИТ-2021-002'),
(3,  8,  'Воронов',   'Дмитрий',   'Николаевич',  '2002-11-03', 1, 'ЗИТ-2021-003'),
(4,  9,  'Лебедева',  'Анастасия', 'Олеговна',    '2003-02-18', 1, 'ЗИТ-2021-004'),
(5,  10, 'Козлов',    'Илья',      'Владимирович','2003-09-07', 1, 'ЗИТ-2021-005'),
(6,  11, 'Новикова',  'Екатерина', 'Романовна',   '2002-12-30', 1, 'ЗИТ-2021-006'),
(7,  12, 'Фёдоров',   'Никита',    'Юрьевич',     '2003-05-21', 1, 'ЗИТ-2021-007'),
(8,  13, 'Зайцева',   'Ольга',     'Дмитриевна',  '2003-01-14', 1, 'ЗИТ-2021-008'),
(9,  14, 'Соколов',   'Кирилл',    'Андреевич',   '2002-08-09', 1, 'ЗИТ-2021-009'),
(10, 15, 'Михайлова', 'Валерия',   'Сергеевна',   '2003-03-27', 1, 'ЗИТ-2021-010'),
-- Группа ЗИВТ-221
(11, 16, 'Алексеев',  'Роман',     'Павлович',    '2004-06-15', 2, 'ЗИТ-2022-001'),
(12, 17, 'Степанова', 'Лидия',     'Игоревна',    '2004-10-02', 2, 'ЗИТ-2022-002'),
(13, 18, 'Дмитриев',  'Антон',     'Васильевич',  '2004-03-19', 2, 'ЗИТ-2022-003'),
(14, 19, 'Иванова',   'Надежда',   'Сергеевна',   '2004-08-28', 2, 'ЗИТ-2022-004'),
(15, 20, 'Семёнов',   'Владимир',  'Игоревич',    '2004-01-11', 2, 'ЗИТ-2022-005'),
(16, 21, 'Григорьева','Татьяна',   'Николаевна',  '2004-07-04', 2, 'ЗИТ-2022-006'),
(17, 22, 'Никитин',   'Павел',     'Александрович','2004-04-23', 2, 'ЗИТ-2022-007'),
(18, 23, 'Попова',    'Юлия',      'Викторовна',  '2004-11-16', 2, 'ЗИТ-2022-008');

SELECT setval('students_id_seq', 18);

-- ============================================================
-- 6. ДИСЦИПЛИНЫ
-- ============================================================

INSERT INTO subjects (id, name, code, hours_total, control_form, department_id) VALUES
(1, 'Базы данных',                           'BD',   72,  'экзамен',                   1),
(2, 'Веб-разработка',                        'WEB',  108, 'дифференцированный зачёт',  1),
(3, 'Алгоритмы и структуры данных',          'ASD',  72,  'экзамен',                   1),
(4, 'Операционные системы',                  'OS',   54,  'зачёт',                     1),
(5, 'Математический анализ',                 'MA',   108, 'экзамен',                   2),
(6, 'Теория вероятностей и статистика',      'TVS',  54,  'зачёт',                     2);

SELECT setval('subjects_id_seq', 6);

-- ============================================================
-- 7. НАЗНАЧЕНИЯ ПРЕПОДАВАТЕЛЕЙ
-- ============================================================

INSERT INTO teaching_assignments (id, teacher_id, subject_id, group_id, semester, acad_year) VALUES
-- ЗИВТ-211, 5-й семестр 2025-2026
(1, 1, 1, 1, 5, '2025-2026'),  -- Анатольев > БД > ЗИВТ-211
(2, 2, 2, 1, 5, '2025-2026'),  -- Кузнецова > Веб > ЗИВТ-211
(3, 3, 3, 1, 5, '2025-2026'),  -- Морозов   > АСД > ЗИВТ-211
(4, 4, 4, 1, 5, '2025-2026'),  -- Сорокина  > ОС  > ЗИВТ-211
-- ЗИВТ-221, 3-й семестр 2025-2026
(5, 1, 1, 2, 3, '2025-2026'),  -- Анатольев > БД > ЗИВТ-221
(6, 2, 2, 2, 3, '2025-2026'),  -- Кузнецова > Веб > ЗИВТ-221
(7, 4, 5, 2, 3, '2025-2026'),  -- Сорокина  > МА  > ЗИВТ-221
-- Прошлый год, для истории
(8, 3, 3, 1, 3, '2023-2024'),
(9, 4, 5, 1, 3, '2023-2024');

SELECT setval('teaching_assignments_id_seq', 9);

-- ============================================================
-- 8. ТЕМЫ ДИСЦИПЛИН
-- ============================================================

-- Базы данных
INSERT INTO topics (id, subject_id, title, order_num, parent_id) VALUES
(1,  1, 'Введение в реляционные базы данных',       1, NULL),
(2,  1, 'Реляционная модель данных',                 2, NULL),
(3,  1,   'Отношения, атрибуты, кортежи',            1, 2),
(4,  1,   'Нормализация (1НФ–3НФ, НФБК)',            2, 2),
(5,  1, 'Язык SQL',                                  3, NULL),
(6,  1,   'DDL: CREATE, ALTER, DROP',                1, 5),
(7,  1,   'DML: SELECT, INSERT, UPDATE, DELETE',     2, 5),
(8,  1,   'Агрегатные функции и GROUP BY',           3, 5),
(9,  1,   'JOIN-запросы',                            4, 5),
(10, 1, 'Индексы и оптимизация запросов',            4, NULL),
(11, 1, 'Транзакции и ACID',                         5, NULL),
-- Веб-разработка
(12, 2, 'HTML и CSS основы',                         1, NULL),
(13, 2, 'JavaScript',                                2, NULL),
(14, 2,   'Основы языка',                            1, 13),
(15, 2,   'DOM и события',                           2, 13),
(16, 2,   'Асинхронность: Promise, async/await',     3, 13),
(17, 2, 'Backend: Python Flask / FastAPI',           3, NULL),
(18, 2, 'REST API',                                  4, NULL),
-- АСД
(19, 3, 'Сложность алгоритмов (O-нотация)',          1, NULL),
(20, 3, 'Массивы, списки, стеки, очереди',           2, NULL),
(21, 3, 'Деревья и графы',                           3, NULL),
(22, 3, 'Алгоритмы сортировки',                      4, NULL),
(23, 3, 'Алгоритмы поиска',                          5, NULL);

SELECT setval('topics_id_seq', 23);

-- ============================================================
-- 9. ВОПРОСЫ (банк)
-- ============================================================

-- Тема: Реляционная модель (id=2)
INSERT INTO questions (id, topic_id, author_id, question_type, difficulty, body, explanation, score_max, options) VALUES
(1, 2, 1, 'single_choice', 'easy',
 'Основная структура хранения данных в реляционной БД — это:',
 'В реляционной модели данные хранятся в таблицах (отношениях).',
 1,
 '[{"id":1,"text":"Таблица (отношение)","is_correct":true},
   {"id":2,"text":"Граф","is_correct":false},
   {"id":3,"text":"Дерево","is_correct":false},
   {"id":4,"text":"Хэш-таблица","is_correct":false}]'::jsonb),

(2, 2, 1, 'multiple_choice', 'medium',
 'Свойства ACID транзакций включают (выберите все верные):',
 'ACID = Atomicity, Consistency, Isolation, Durability.',
 2,
 '[{"id":1,"text":"Атомарность","is_correct":true},
   {"id":2,"text":"Согласованность","is_correct":true},
   {"id":3,"text":"Скорость выполнения","is_correct":false},
   {"id":4,"text":"Изолированность","is_correct":true},
   {"id":5,"text":"Долговечность","is_correct":true}]'::jsonb),

(3, 2, 1, 'single_choice', 'medium',
 'Что такое первичный ключ (Primary Key)?',
 'Первичный ключ — уникальный идентификатор строки в таблице, не может быть NULL.',
 1,
 '[{"id":1,"text":"Поле, которое может повторяться","is_correct":false},
   {"id":2,"text":"Уникальный идентификатор строки, не NULL","is_correct":true},
   {"id":3,"text":"Внешняя ссылка на другую таблицу","is_correct":false},
   {"id":4,"text":"Индекс для ускорения поиска","is_correct":false}]'::jsonb);

-- Тема: Нормализация (id=4)
INSERT INTO questions (id, topic_id, author_id, question_type, difficulty, body, explanation, score_max, options) VALUES
(4, 4, 1, 'single_choice', 'medium',
 'В какой нормальной форме устраняются транзитивные зависимости неключевых атрибутов от ключа?',
 '3НФ требует отсутствия транзитивных зависимостей неключевых атрибутов от первичного ключа.',
 1,
 '[{"id":1,"text":"1НФ","is_correct":false},
   {"id":2,"text":"2НФ","is_correct":false},
   {"id":3,"text":"3НФ","is_correct":true},
   {"id":4,"text":"НФБК","is_correct":false}]'::jsonb),

(5, 4, 1, 'single_choice', 'hard',
 'Таблица находится в 2НФ, если:',
 '2НФ: таблица в 1НФ И каждый неключевой атрибут полностью функционально зависит от первичного ключа.',
 1,
 '[{"id":1,"text":"Все атрибуты атомарны","is_correct":false},
   {"id":2,"text":"Нет транзитивных зависимостей","is_correct":false},
   {"id":3,"text":"В 1НФ и каждый неключевой атрибут полностью зависит от первичного ключа","is_correct":true},
   {"id":4,"text":"Нет повторяющихся строк","is_correct":false}]'::jsonb);

-- Тема: SQL SELECT (id=7)
INSERT INTO questions (id, topic_id, author_id, question_type, difficulty, body, explanation, score_max, options) VALUES
(6, 7, 1, 'single_choice', 'easy',
 'Какой оператор используется для выборки данных из таблицы?',
 'SELECT — основной оператор чтения данных в SQL.',
 1,
 '[{"id":1,"text":"GET","is_correct":false},
   {"id":2,"text":"SELECT","is_correct":true},
   {"id":3,"text":"FETCH","is_correct":false},
   {"id":4,"text":"READ","is_correct":false}]'::jsonb),

(7, 7, 1, 'multiple_choice', 'medium',
 'Какие из перечисленных являются агрегатными функциями SQL?',
 'Агрегатные функции: COUNT, SUM, AVG, MIN, MAX.',
 2,
 '[{"id":1,"text":"COUNT","is_correct":true},
   {"id":2,"text":"UPPER","is_correct":false},
   {"id":3,"text":"SUM","is_correct":true},
   {"id":4,"text":"AVG","is_correct":true},
   {"id":5,"text":"TRIM","is_correct":false}]'::jsonb),

(8, 7, 1, 'text_input', 'hard',
 'Напишите SQL-запрос для выборки всех студентов из таблицы students, у которых group_id = 1, упорядочив по фамилии.',
 'SELECT * FROM students WHERE group_id = 1 ORDER BY last_name;',
 3,
 NULL),

-- Тема: JOIN (id=9)
(9, 9, 1, 'single_choice', 'medium',
 'Какой тип JOIN возвращает все строки из левой таблицы и совпадающие из правой?',
 'LEFT JOIN (LEFT OUTER JOIN) возвращает все строки левой таблицы, дополняя NULL там, где нет совпадений.',
 1,
 '[{"id":1,"text":"INNER JOIN","is_correct":false},
   {"id":2,"text":"LEFT JOIN","is_correct":true},
   {"id":3,"text":"RIGHT JOIN","is_correct":false},
   {"id":4,"text":"CROSS JOIN","is_correct":false}]'::jsonb),

(10, 9, 1, 'matching', 'hard',
 'Сопоставьте тип JOIN с описанием:',
 'Классификация JOIN по типу объединения строк.',
 2,
 '[{"left":"INNER JOIN",  "right":"Только совпадающие строки из обеих таблиц"},
   {"left":"LEFT JOIN",   "right":"Все строки левой + совпадения из правой"},
   {"left":"FULL JOIN",   "right":"Все строки из обеих таблиц"},
   {"left":"CROSS JOIN",  "right":"Декартово произведение таблиц"}]'::jsonb),

-- Тема: Транзакции (id=11)
(11, 11, 1, 'single_choice', 'easy',
 'Какая команда SQL фиксирует (сохраняет) транзакцию?',
 'COMMIT завершает транзакцию и сохраняет все изменения в БД.',
 1,
 '[{"id":1,"text":"SAVE","is_correct":false},
   {"id":2,"text":"COMMIT","is_correct":true},
   {"id":3,"text":"APPLY","is_correct":false},
   {"id":4,"text":"FLUSH","is_correct":false}]'::jsonb),

-- Тема: JavaScript основы (id=14)
(12, 14, 2, 'single_choice', 'easy',
 'Какой оператор используется для объявления переменной с блочной областью видимости в современном JS?',
 'let объявляет переменную с блочной областью видимости (ES6+).',
 1,
 '[{"id":1,"text":"var","is_correct":false},
   {"id":2,"text":"let","is_correct":true},
   {"id":3,"text":"def","is_correct":false},
   {"id":4,"text":"dim","is_correct":false}]'::jsonb),

(13, 14, 2, 'multiple_choice', 'medium',
 'Какие из перечисленных являются примитивными типами данных в JavaScript?',
 'Примитивы JS: string, number, boolean, null, undefined, symbol, bigint.',
 2,
 '[{"id":1,"text":"string","is_correct":true},
   {"id":2,"text":"array","is_correct":false},
   {"id":3,"text":"boolean","is_correct":true},
   {"id":4,"text":"object","is_correct":false},
   {"id":5,"text":"number","is_correct":true}]'::jsonb),

-- Тема: АСД — Сложность (id=19)
(14, 19, 3, 'single_choice', 'medium',
 'Какова временная сложность бинарного поиска в отсортированном массиве?',
 'Бинарный поиск делит массив пополам на каждом шаге > O(log n).',
 1,
 '[{"id":1,"text":"O(1)","is_correct":false},
   {"id":2,"text":"O(n)","is_correct":false},
   {"id":3,"text":"O(log n)","is_correct":true},
   {"id":4,"text":"O(n?)","is_correct":false}]'::jsonb),

(15, 19, 3, 'ordering', 'hard',
 'Расставьте алгоритмы сортировки в порядке возрастания средней временной сложности:',
 'Пузырьковая O(n?) < Быстрая O(n log n) < ... порядок важен.',
 2,
 '[{"text":"Пузырьковая сортировка — O(n?)","order":3},
   {"text":"Сортировка вставками — O(n?)","order":3},
   {"text":"Сортировка слиянием — O(n log n)","order":2},
   {"text":"Быстрая сортировка — O(n log n)","order":2},
   {"text":"Поразрядная сортировка — O(nk)","order":1}]'::jsonb);

SELECT setval('questions_id_seq', 15);

-- ============================================================
-- 10. ТЕСТЫ
-- ============================================================

INSERT INTO tests (id, subject_id, author_id, title, description, status,
                   time_limit_minutes, attempts_allowed, passing_score_pct,
                   questions_count, shuffle_questions, shuffle_options,
                   available_from, available_to) VALUES
(1, 1, 1,
 'Контрольная №1: Реляционная модель и нормализация',
 'Проверка знаний по темам: реляционная модель, первичные ключи, нормальные формы.',
 'published', 30, 2, 60,
 NULL, TRUE, TRUE,
 NOW() - INTERVAL '14 days', NOW() + INTERVAL '7 days'),

(2, 1, 1,
 'Контрольная №2: Язык SQL',
 'SELECT, агрегатные функции, JOIN-запросы.',
 'published', 45, 1, 65,
 NULL, TRUE, TRUE,
 NOW() - INTERVAL '7 days', NOW() + INTERVAL '14 days'),

(3, 1, 1,
 'Итоговый тест: Базы данных',
 'Итоговый тест по всему курсу БД.',
 'draft', 60, 1, 70,
 NULL, TRUE, TRUE,
 NOW() + INTERVAL '30 days', NOW() + INTERVAL '37 days'),

(4, 2, 2,
 'Тест: JavaScript основы',
 'Типы данных, переменные, функции.',
 'published', 20, 2, 60,
 5, TRUE, TRUE,
 NOW() - INTERVAL '5 days', NOW() + INTERVAL '10 days'),

(5, 3, 3,
 'Тест: Алгоритмическая сложность',
 'O-нотация, сравнение алгоритмов.',
 'published', 25, 1, 60,
 NULL, FALSE, TRUE,
 NOW() - INTERVAL '3 days', NOW() + INTERVAL '4 days');

SELECT setval('tests_id_seq', 5);

-- ============================================================
-- 11. ВОПРОСЫ В ТЕСТАХ
-- ============================================================

-- Тест 1: Реляционная модель
INSERT INTO test_questions (test_id, question_id, order_num) VALUES
(1, 1, 1), (1, 2, 2), (1, 3, 3), (1, 4, 4), (1, 5, 5);

-- Тест 2: SQL
INSERT INTO test_questions (test_id, question_id, order_num) VALUES
(2, 6, 1), (2, 7, 2), (2, 8, 3), (2, 9, 4), (2, 10, 5), (2, 11, 6);

-- Тест 4: JavaScript
INSERT INTO test_questions (test_id, question_id, order_num) VALUES
(4, 12, 1), (4, 13, 2);

-- Тест 5: АСД
INSERT INTO test_questions (test_id, question_id, order_num) VALUES
(5, 14, 1), (5, 15, 2);

-- ============================================================
-- 12. НАЗНАЧЕНИЕ ТЕСТОВ ГРУППАМ
-- ============================================================

INSERT INTO test_assignments (test_id, group_id, assigned_by) VALUES
(1, 1, 1), -- Контр. №1 > ЗИВТ-211
(1, 2, 1), -- Контр. №1 > ЗИВТ-221
(2, 1, 1), -- Контр. №2 > ЗИВТ-211
(3, 1, 1), -- Итоговый  > ЗИВТ-211
(4, 1, 2), -- JS тест   > ЗИВТ-211
(5, 1, 3); -- АСД тест  > ЗИВТ-211

-- ============================================================
-- 13. СЕССИИ ПРОХОЖДЕНИЯ ТЕСТОВ (Тест 1, ЗИВТ-211)
-- ============================================================

INSERT INTO test_sessions
  (id, test_id, student_id, attempt_number, status,
   started_at, finished_at, score_total, score_max, passed) VALUES
-- Студент 1 (Петров) — сдал с первого раза
(1,  1, 1,  1, 'completed', NOW()-INTERVAL '13d 2h', NOW()-INTERVAL '13d 1h 38m',  6.0, 7.0, TRUE),
-- Студент 2 (Сидорова) — первая попытка провалена, вторая успешна
(2,  1, 2,  1, 'completed', NOW()-INTERVAL '13d 3h', NOW()-INTERVAL '13d 2h 45m',  3.5, 7.0, FALSE),
(3,  1, 2,  2, 'completed', NOW()-INTERVAL '10d 2h', NOW()-INTERVAL '10d 1h 40m',  5.0, 7.0, TRUE),
-- Студент 3 (Воронов) — отлично
(4,  1, 3,  1, 'completed', NOW()-INTERVAL '13d 1h', NOW()-INTERVAL '13d 0h 42m',  7.0, 7.0, TRUE),
-- Студент 4 (Лебедева)
(5,  1, 4,  1, 'completed', NOW()-INTERVAL '12d 4h', NOW()-INTERVAL '12d 3h 25m',  4.5, 7.0, TRUE),
-- Студент 5 (Козлов) — не сдал
(6,  1, 5,  1, 'completed', NOW()-INTERVAL '12d 2h', NOW()-INTERVAL '12d 1h 50m',  3.0, 7.0, FALSE),
(7,  1, 5,  2, 'completed', NOW()-INTERVAL '9d 2h',  NOW()-INTERVAL '9d 1h 30m',   4.5, 7.0, TRUE),
-- Студент 6 (Новикова)
(8,  1, 6,  1, 'completed', NOW()-INTERVAL '12d 1h', NOW()-INTERVAL '12d 0h 28m',  5.5, 7.0, TRUE),
-- Студент 7 (Фёдоров) — истекло время
(9,  1, 7,  1, 'timed_out', NOW()-INTERVAL '11d 3h', NOW()-INTERVAL '11d 2h 30m',  2.0, 7.0, FALSE),
(10, 1, 7,  2, 'completed', NOW()-INTERVAL '8d 2h',  NOW()-INTERVAL '8d 1h 45m',   5.0, 7.0, TRUE),
-- Студент 8 (Зайцева)
(11, 1, 8,  1, 'completed', NOW()-INTERVAL '11d 1h', NOW()-INTERVAL '11d 0h 22m',  6.5, 7.0, TRUE),
-- Студент 9 (Соколов)
(12, 1, 9,  1, 'completed', NOW()-INTERVAL '10d 4h', NOW()-INTERVAL '10d 3h 32m',  4.0, 7.0, TRUE),
-- Студент 10 (Михайлова)
(13, 1, 10, 1, 'completed', NOW()-INTERVAL '10d 2h', NOW()-INTERVAL '10d 1h 18m',  5.5, 7.0, TRUE),
-- Тест 2 (SQL), несколько студентов
(14, 2, 1,  1, 'completed', NOW()-INTERVAL '6d 3h',  NOW()-INTERVAL '6d 2h 12m',   8.0, 10.0, TRUE),
(15, 2, 2,  1, 'completed', NOW()-INTERVAL '6d 2h',  NOW()-INTERVAL '6d 1h 30m',   6.5, 10.0, TRUE),
(16, 2, 3,  1, 'completed', NOW()-INTERVAL '5d 4h',  NOW()-INTERVAL '5d 3h 20m',   9.5, 10.0, TRUE),
(17, 2, 4,  1, 'completed', NOW()-INTERVAL '5d 2h',  NOW()-INTERVAL '5d 1h 10m',   5.0, 10.0, FALSE),
(18, 2, 5,  1, 'in_progress', NOW()-INTERVAL '2h',   NULL,                          NULL, NULL, NULL),
-- Тест 4 (JS)
(19, 4, 1,  1, 'completed', NOW()-INTERVAL '4d 1h',  NOW()-INTERVAL '4d 0h 45m',   2.5, 3.0, TRUE),
(20, 4, 2,  1, 'completed', NOW()-INTERVAL '4d 2h',  NOW()-INTERVAL '4d 1h 30m',   1.5, 3.0, FALSE),
(21, 4, 6,  1, 'completed', NOW()-INTERVAL '3d 1h',  NOW()-INTERVAL '3d 0h 20m',   3.0, 3.0, TRUE);

SELECT setval('test_sessions_id_seq', 21);

-- ============================================================
-- 14. ОТВЕТЫ НА ВОПРОСЫ (сессия 1: Петров, Тест 1)
-- ============================================================

INSERT INTO question_answers
  (session_id, question_id, answer_data, score_earned, is_correct, time_spent_sec) VALUES
(1, 1, '{"selected":1}'::jsonb,         1.0, TRUE,  45),
(1, 2, '{"selected":[1,2,4,5]}'::jsonb, 2.0, TRUE,  90),
(1, 3, '{"selected":2}'::jsonb,         1.0, TRUE,  30),
(1, 4, '{"selected":3}'::jsonb,         1.0, TRUE,  55),
(1, 5, '{"selected":1}'::jsonb,         0.0, FALSE,  70),

-- Сессия 4: Воронов — всё правильно
(4, 1, '{"selected":1}'::jsonb,         1.0, TRUE,  25),
(4, 2, '{"selected":[1,2,4,5]}'::jsonb, 2.0, TRUE,  60),
(4, 3, '{"selected":2}'::jsonb,         1.0, TRUE,  20),
(4, 4, '{"selected":3}'::jsonb,         1.0, TRUE,  35),
(4, 5, '{"selected":3}'::jsonb,         1.0, TRUE,  40),

-- Сессия 14: Петров, Тест 2 (SQL)
(14, 6,  '{"selected":2}'::jsonb,                    1.0, TRUE,  20),
(14, 7,  '{"selected":[1,3,4]}'::jsonb,              2.0, TRUE,  75),
(14, 8,  '{"text":"SELECT * FROM students WHERE group_id = 1 ORDER BY last_name;"}'::jsonb, 3.0, TRUE, 180),
(14, 9,  '{"selected":2}'::jsonb,                    1.0, TRUE,  30),
(14, 10, '{"pairs":[[1,1],[2,2],[3,3],[4,4]]}'::jsonb, 1.0, FALSE, 120),
(14, 11, '{"selected":2}'::jsonb,                    0.0, FALSE,  15);

-- ============================================================
-- 15. ЖУРНАЛ ОЦЕНОК
-- ============================================================

INSERT INTO grades
  (student_id, assignment_id, grade_type, value, passed, date_recorded, recorded_by, session_id)
VALUES
-- Текущие оценки по БД (назначение 1)
(1,  1, 'current',  5.0, TRUE,  NOW()-INTERVAL '13d', 1, 1),
(2,  1, 'current',  3.0, FALSE, NOW()-INTERVAL '13d', 1, 2),
(2,  1, 'current',  4.0, TRUE,  NOW()-INTERVAL '10d', 1, 3),
(3,  1, 'current',  5.0, TRUE,  NOW()-INTERVAL '13d', 1, 4),
(4,  1, 'current',  4.0, TRUE,  NOW()-INTERVAL '12d', 1, 5),
(5,  1, 'current',  2.0, FALSE, NOW()-INTERVAL '12d', 1, 6),
(5,  1, 'current',  4.0, TRUE,  NOW()-INTERVAL '9d',  1, 7),
(6,  1, 'current',  4.0, TRUE,  NOW()-INTERVAL '12d', 1, 8),
(7,  1, 'current',  4.0, TRUE,  NOW()-INTERVAL '8d',  1, 10),
(8,  1, 'current',  5.0, TRUE,  NOW()-INTERVAL '11d', 1, 11),
(9,  1, 'current',  4.0, TRUE,  NOW()-INTERVAL '10d', 1, 12),
(10, 1, 'current',  4.0, TRUE,  NOW()-INTERVAL '10d', 1, 13),
-- Текущие оценки по SQL (назначение 1, контр. №2)
(1,  1, 'current',  5.0, TRUE,  NOW()-INTERVAL '6d',  1, 14),
(2,  1, 'current',  4.0, TRUE,  NOW()-INTERVAL '6d',  1, 15),
(3,  1, 'current',  5.0, TRUE,  NOW()-INTERVAL '5d',  1, 16),
(4,  1, 'current',  3.0, FALSE, NOW()-INTERVAL '5d',  1, 17),
-- Ручные оценки за лекции/практики по БД
(1,  1, 'thematic', 5.0, TRUE,  NOW()-INTERVAL '20d', 1, NULL),
(2,  1, 'thematic', 4.0, TRUE,  NOW()-INTERVAL '20d', 1, NULL),
(3,  1, 'thematic', 5.0, TRUE,  NOW()-INTERVAL '20d', 1, NULL),
(5,  1, 'thematic', 3.0, TRUE,  NOW()-INTERVAL '20d', 1, NULL),
-- Оценки по Веб-разработке
(1,  2, 'current',  5.0, TRUE,  NOW()-INTERVAL '4d',  2, 19),
(2,  2, 'current',  3.0, FALSE, NOW()-INTERVAL '4d',  2, 20),
(6,  2, 'current',  5.0, TRUE,  NOW()-INTERVAL '3d',  2, 21);

-- ============================================================
-- 16. ПОСЕЩАЕМОСТЬ (последние 4 занятия по БД)
-- ============================================================

DO $$
DECLARE
  dates DATE[] := ARRAY[
    (NOW()-INTERVAL '28d')::DATE,
    (NOW()-INTERVAL '21d')::DATE,
    (NOW()-INTERVAL '14d')::DATE,
    (NOW()-INTERVAL '7d')::DATE
  ];
  d DATE;
  s_id INT;
  present BOOLEAN;
BEGIN
  FOREACH d IN ARRAY dates LOOP
    FOR s_id IN 1..10 LOOP
      -- 85% посещаемость, студент 7 (Фёдоров) прогуливает чаще
      present := CASE
        WHEN s_id = 7 THEN random() > 0.4
        WHEN s_id = 5 THEN random() > 0.25
        ELSE random() > 0.1
      END;
      INSERT INTO attendance (student_id, assignment_id, lesson_date, is_present, recorded_by)
      VALUES (s_id, 1, d, present, 1)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- 17. АДАПТИВНЫЕ РЕКОМЕНДАЦИИ
-- ============================================================

INSERT INTO adaptive_recommendations
  (student_id, topic_id, mastery_level, recommended_difficulty) VALUES
-- Петров: силён в SQL, слабее в нормализации
(1, 2,  0.85, 'hard'),
(1, 4,  0.55, 'medium'),
(1, 7,  0.90, 'hard'),
(1, 9,  0.70, 'medium'),
(1, 11, 0.80, 'hard'),
-- Сидорова: равномерно средний уровень
(2, 2,  0.60, 'medium'),
(2, 4,  0.45, 'easy'),
(2, 7,  0.65, 'medium'),
-- Воронов: отличник
(3, 2,  0.95, 'hard'),
(3, 4,  0.88, 'hard'),
(3, 7,  0.92, 'hard'),
(3, 9,  0.85, 'hard'),
-- Козлов: слабый
(5, 2,  0.40, 'easy'),
(5, 4,  0.30, 'easy'),
(5, 7,  0.50, 'medium');

-- ============================================================
-- 18. УВЕДОМЛЕНИЯ
-- ============================================================

INSERT INTO notifications (user_id, type, title, body, is_read) VALUES
-- Студентам о назначении тестов
(6,  'test_assigned', 'Назначен новый тест',
     'Вам назначен тест "Контрольная №2: Язык SQL". Срок до ' || (NOW()+INTERVAL '14d')::DATE::TEXT, FALSE),
(7,  'test_assigned', 'Назначен новый тест',
     'Вам назначен тест "Контрольная №2: Язык SQL". Срок до ' || (NOW()+INTERVAL '14d')::DATE::TEXT, FALSE),
-- Результаты тестов
(6,  'test_result', 'Результат теста',
     'Тест "Контрольная №1" завершён. Ваш результат: 6.0/7.0 — Зачтено ?', TRUE),
(7,  'test_result', 'Результат теста',
     'Тест "Контрольная №1" (попытка 1) — Не зачтено. Доступна вторая попытка.', TRUE),
(7,  'test_result', 'Результат теста',
     'Тест "Контрольная №1" (попытка 2) — Зачтено ?. Результат: 5.0/7.0', FALSE),
-- Напоминания о дедлайнах
(8,  'reminder',     'Дедлайн через 7 дней',
     'Тест "Контрольная №2: Язык SQL" истекает ' || (NOW()+INTERVAL '14d')::DATE::TEXT, FALSE),
(9,  'reminder',     'Дедлайн через 7 дней',
     'Тест "Контрольная №2: Язык SQL" истекает ' || (NOW()+INTERVAL '14d')::DATE::TEXT, FALSE),
-- Преподавателю
(2,  'grade_added',  'Оценки выставлены',
     'Автоматически выставлены оценки по результатам Контрольной №1 (18 записей).', TRUE);

-- ============================================================
-- 19. АУДИТ-ЛОГ
-- ============================================================

INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_data) VALUES
(1, 'user.create',   'users',    2, '{"email":"anatolev@college.ru","role":"teacher"}'::jsonb),
(1, 'user.create',   'users',    3, '{"email":"kuznetsova@college.ru","role":"teacher"}'::jsonb),
(2, 'test.publish',  'tests',    1, '{"status":"published","title":"Контрольная №1"}'::jsonb),
(2, 'test.publish',  'tests',    2, '{"status":"published","title":"Контрольная №2"}'::jsonb),
(1, 'grade.create',  'grades',   1, '{"student_id":1,"value":5.0,"grade_type":"current"}'::jsonb),
(2, 'test.assign',   'test_assignments', 1, '{"test_id":1,"group_id":1}'::jsonb);

COMMIT;

-- ============================================================
-- ПРОВЕРОЧНЫЕ ЗАПРОСЫ
-- ============================================================

-- Статистика по таблицам
SELECT 'users'               AS tbl, COUNT(*) FROM users
UNION ALL SELECT 'teachers',          COUNT(*) FROM teachers
UNION ALL SELECT 'students',          COUNT(*) FROM students
UNION ALL SELECT 'subjects',          COUNT(*) FROM subjects
UNION ALL SELECT 'topics',            COUNT(*) FROM topics
UNION ALL SELECT 'questions',         COUNT(*) FROM questions
UNION ALL SELECT 'tests',             COUNT(*) FROM tests
UNION ALL SELECT 'test_sessions',     COUNT(*) FROM test_sessions
UNION ALL SELECT 'question_answers',  COUNT(*) FROM question_answers
UNION ALL SELECT 'grades',            COUNT(*) FROM grades
UNION ALL SELECT 'attendance',        COUNT(*) FROM attendance
UNION ALL SELECT 'notifications',     COUNT(*) FROM notifications
ORDER BY tbl;
