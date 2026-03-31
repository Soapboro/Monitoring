from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    auth,
    users,
    departments,
    groups,
    teachers,
    students,
    subjects,
    teaching_assignments,
    topics,
    questions,
    tests,
    test_sessions,
    grades,
    attendance,
    analytics,
    reports,
    notifications,
)

app = FastAPI(
    title="Система мониторинга успеваемости",
    description="API автоматизированной системы мониторинга успеваемости обучающихся",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(departments.router)
app.include_router(groups.router)
app.include_router(teachers.router)
app.include_router(students.router)
app.include_router(subjects.router)
app.include_router(teaching_assignments.router)
app.include_router(topics.router)
app.include_router(questions.router)
app.include_router(tests.router)
app.include_router(test_sessions.router)
app.include_router(grades.router)
app.include_router(attendance.router)
app.include_router(analytics.router)
app.include_router(reports.router)
app.include_router(notifications.router)


@app.get("/", tags=["health"])
async def root():
    return {"status": "ok", "message": "Система мониторинга успеваемости"}


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
