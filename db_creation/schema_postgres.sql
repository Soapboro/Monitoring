-- ============================================================
-- Автоматизированная система мониторинга успеваемости
-- База данных: PostgreSQL 15+
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TYPE user_role         AS ENUM ('admin', 'teacher', 'student');
CREATE TYPE question_type_t   AS ENUM ('single_choice','multiple_choice','text_input','matching','ordering');
CREATE TYPE difficulty_t      AS ENUM ('easy','medium','hard');
CREATE TYPE test_status_t     AS ENUM ('draft','published','archived');
CREATE TYPE session_status_t  AS ENUM ('in_progress','completed','timed_out','abandoned');
CREATE TYPE grade_type_t      AS ENUM ('current','thematic','midterm','final','attendance');
CREATE TYPE notif_type_t      AS ENUM ('test_assigned','test_result','grade_added','reminder');

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    uuid            UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ
);

CREATE TABLE departments (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    code        VARCHAR(20) UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE groups (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(50) NOT NULL UNIQUE,
    year_start      SMALLINT NOT NULL,
    department_id   INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teachers (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_name   VARCHAR(100) NOT NULL,
    first_name  VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    position    VARCHAR(200),
    phone       VARCHAR(30),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE students (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    last_name   VARCHAR(100) NOT NULL,
    first_name  VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    birth_date  DATE,
    group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
    student_num VARCHAR(30) UNIQUE,
    phone       VARCHAR(30),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_students_group ON students(group_id);
CREATE INDEX idx_students_fts   ON students USING GIN (
    to_tsvector('russian', last_name || ' ' || first_name || ' ' || COALESCE(middle_name,''))
);

CREATE TABLE subjects (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(300) NOT NULL,
    code            VARCHAR(30),
    hours_total     SMALLINT,
    control_form    VARCHAR(100),
    department_id   INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teaching_assignments (
    id          SERIAL PRIMARY KEY,
    teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    semester    SMALLINT NOT NULL CHECK (semester BETWEEN 1 AND 20),
    acad_year   VARCHAR(9) NOT NULL,
    UNIQUE (teacher_id, subject_id, group_id, semester, acad_year)
);
CREATE INDEX idx_ta_teacher ON teaching_assignments(teacher_id);
CREATE INDEX idx_ta_group   ON teaching_assignments(group_id);

CREATE TABLE topics (
    id          SERIAL PRIMARY KEY,
    subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title       VARCHAR(500) NOT NULL,
    order_num   SMALLINT DEFAULT 1,
    parent_id   INTEGER REFERENCES topics(id) ON DELETE SET NULL
);
CREATE INDEX idx_topics_subject ON topics(subject_id);

CREATE TABLE questions (
    id              SERIAL PRIMARY KEY,
    topic_id        INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    author_id       INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
    question_type   question_type_t NOT NULL DEFAULT 'single_choice',
    difficulty      difficulty_t NOT NULL DEFAULT 'medium',
    body            TEXT NOT NULL,
    explanation     TEXT,
    score_max       NUMERIC(5,2) NOT NULL DEFAULT 1,
    options         JSONB,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_questions_topic      ON questions(topic_id);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);
CREATE INDEX idx_questions_options    ON questions USING GIN (options);

CREATE TABLE tests (
    id                  SERIAL PRIMARY KEY,
    subject_id          INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    author_id           INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
    title               VARCHAR(500) NOT NULL,
    description         TEXT,
    status              test_status_t NOT NULL DEFAULT 'draft',
    time_limit_minutes  SMALLINT,
    attempts_allowed    SMALLINT DEFAULT 1,
    passing_score_pct   NUMERIC(5,2) DEFAULT 60,
    questions_count     SMALLINT,
    shuffle_questions   BOOLEAN DEFAULT TRUE,
    shuffle_options     BOOLEAN DEFAULT TRUE,
    show_results        BOOLEAN DEFAULT TRUE,
    available_from      TIMESTAMPTZ,
    available_to        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE test_questions (
    id          SERIAL PRIMARY KEY,
    test_id     INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    order_num   SMALLINT DEFAULT 1,
    score_max   NUMERIC(5,2),
    UNIQUE (test_id, question_id)
);
CREATE INDEX idx_test_questions_test ON test_questions(test_id);

CREATE TABLE test_assignments (
    id              SERIAL PRIMARY KEY,
    test_id         INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    group_id        INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    assigned_by     INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
    available_from  TIMESTAMPTZ,
    available_to    TIMESTAMPTZ,
    UNIQUE (test_id, group_id)
);
CREATE INDEX idx_test_assignments_group ON test_assignments(group_id);

CREATE TABLE test_sessions (
    id              SERIAL PRIMARY KEY,
    test_id         INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    attempt_number  SMALLINT NOT NULL DEFAULT 1,
    status          session_status_t NOT NULL DEFAULT 'in_progress',
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    question_order  JSONB,
    score_total     NUMERIC(7,2),
    score_max       NUMERIC(7,2),
    passed          BOOLEAN,
    ip_address      INET,
    UNIQUE (test_id, student_id, attempt_number)
);
CREATE INDEX idx_sessions_student ON test_sessions(student_id);
CREATE INDEX idx_sessions_test    ON test_sessions(test_id);
CREATE INDEX idx_sessions_status  ON test_sessions(status);

CREATE TABLE question_answers (
    id              SERIAL PRIMARY KEY,
    session_id      INTEGER NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
    question_id     INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer_data     JSONB,
    score_earned    NUMERIC(5,2),
    is_correct      BOOLEAN,
    answered_at     TIMESTAMPTZ DEFAULT NOW(),
    time_spent_sec  SMALLINT,
    UNIQUE (session_id, question_id)
);
CREATE INDEX idx_answers_session  ON question_answers(session_id);
CREATE INDEX idx_answers_question ON question_answers(question_id);

CREATE TABLE grades (
    id              SERIAL PRIMARY KEY,
    student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    assignment_id   INTEGER NOT NULL REFERENCES teaching_assignments(id) ON DELETE CASCADE,
    grade_type      grade_type_t NOT NULL,
    value           NUMERIC(4,1),
    passed          BOOLEAN,
    comment         TEXT,
    date_recorded   DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by     INTEGER NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
    session_id      INTEGER REFERENCES test_sessions(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_grades_student    ON grades(student_id);
CREATE INDEX idx_grades_assignment ON grades(assignment_id);
CREATE INDEX idx_grades_date       ON grades(date_recorded);

CREATE TABLE attendance (
    id              SERIAL PRIMARY KEY,
    student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    assignment_id   INTEGER NOT NULL REFERENCES teaching_assignments(id) ON DELETE CASCADE,
    lesson_date     DATE NOT NULL,
    is_present      BOOLEAN NOT NULL DEFAULT TRUE,
    comment         TEXT,
    recorded_by     INTEGER NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, assignment_id, lesson_date)
);
CREATE INDEX idx_attendance_student    ON attendance(student_id);
CREATE INDEX idx_attendance_assignment ON attendance(assignment_id);
CREATE INDEX idx_attendance_date       ON attendance(lesson_date);

CREATE TABLE adaptive_recommendations (
    id                      SERIAL PRIMARY KEY,
    student_id              INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    topic_id                INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    mastery_level           NUMERIC(4,3) NOT NULL DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 1),
    recommended_difficulty  difficulty_t NOT NULL DEFAULT 'medium',
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, topic_id)
);
CREATE INDEX idx_adaptive_student ON adaptive_recommendations(student_id);

CREATE TABLE notifications (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        notif_type_t NOT NULL,
    title       VARCHAR(300) NOT NULL,
    body        TEXT,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user   ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE NOT is_read;

CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id   INTEGER,
    old_data    JSONB,
    new_data    JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_time   ON audit_log(created_at);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_upd     BEFORE UPDATE ON users     FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_questions_upd BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_tests_upd     BEFORE UPDATE ON tests     FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Views
CREATE VIEW v_group_avg AS
SELECT g.name AS group_name, s.name AS subject_name,
       ta.acad_year, ta.semester,
       COUNT(DISTINCT gr.student_id) AS students_count,
       ROUND(AVG(gr.value),2) AS avg_grade,
       MIN(gr.value) AS min_grade, MAX(gr.value) AS max_grade
FROM grades gr
JOIN teaching_assignments ta ON ta.id = gr.assignment_id
JOIN groups g ON g.id = ta.group_id
JOIN subjects s ON s.id = ta.subject_id
WHERE gr.grade_type = 'final' AND gr.value IS NOT NULL
GROUP BY g.name, s.name, ta.acad_year, ta.semester;

CREATE VIEW v_test_stats AS
SELECT t.id AS test_id, t.title, s.name AS subject_name,
       COUNT(ts.id) AS attempts,
       COUNT(DISTINCT ts.student_id) AS students,
       ROUND(AVG(ts.score_total / NULLIF(ts.score_max,0) * 100),1) AS avg_pct,
       SUM(CASE WHEN ts.passed THEN 1 ELSE 0 END) AS passed_count
FROM tests t JOIN subjects s ON s.id = t.subject_id
LEFT JOIN test_sessions ts ON ts.test_id = t.id AND ts.status = 'completed'
GROUP BY t.id, t.title, s.name;

CREATE VIEW v_student_progress AS
SELECT st.id AS student_id,
       st.last_name || ' ' || st.first_name AS student_name,
       tp.title AS topic, su.name AS subject,
       ar.mastery_level, ar.recommended_difficulty, ar.updated_at
FROM adaptive_recommendations ar
JOIN students st ON st.id = ar.student_id
JOIN topics tp   ON tp.id = ar.topic_id
JOIN subjects su ON su.id = tp.subject_id;
