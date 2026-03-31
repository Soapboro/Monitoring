import io
from datetime import date
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import cm

from app.database import get_db
from app.models.grade import Grade, GradeType
from app.models.attendance import Attendance
from app.models.student import Student
from app.models.group import Group
from app.models.teaching_assignment import TeachingAssignment
from app.models.subject import Subject
from app.models.user import User
from app.dependencies import require_teacher

router = APIRouter(prefix="/api/reports", tags=["reports"])


async def _get_grade_data(
    db: AsyncSession,
    group_id: int | None,
    subject_id: int | None,
    acad_year: str | None,
    grade_type: str | None,
):
    query = (
        select(
            Student.last_name,
            Student.first_name,
            Student.middle_name,
            Group.name.label("group_name"),
            Subject.name.label("subject_name"),
            TeachingAssignment.acad_year,
            TeachingAssignment.semester,
            Grade.grade_type,
            Grade.value,
            Grade.date_recorded,
        )
        .join(Grade, Grade.student_id == Student.id)
        .join(Group, Student.group_id == Group.id)
        .join(TeachingAssignment, Grade.assignment_id == TeachingAssignment.id)
        .join(Subject, TeachingAssignment.subject_id == Subject.id)
        .order_by(Group.name, Student.last_name, Student.first_name, Subject.name)
    )
    if group_id:
        query = query.where(TeachingAssignment.group_id == group_id)
    if subject_id:
        query = query.where(TeachingAssignment.subject_id == subject_id)
    if acad_year:
        query = query.where(TeachingAssignment.acad_year == acad_year)
    if grade_type:
        query = query.where(Grade.grade_type == grade_type)

    result = await db.execute(query)
    return result.mappings().all()


@router.get("/grades/excel")
async def grades_excel(
    group_id: int | None = Query(None),
    subject_id: int | None = Query(None),
    acad_year: str | None = Query(None),
    grade_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    rows = await _get_grade_data(db, group_id, subject_id, acad_year, grade_type)

    wb = Workbook()
    ws = wb.active
    ws.title = "Оценки"

    headers = ["Группа", "Фамилия", "Имя", "Отчество", "Дисциплина", "Уч. год", "Семестр", "Тип оценки", "Оценка", "Дата"]
    header_font = Font(bold=True)
    header_fill = PatternFill("solid", fgColor="4472C4")
    header_alignment = Alignment(horizontal="center", wrap_text=True)

    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = header_fill
        cell.alignment = header_alignment

    for row_idx, r in enumerate(rows, 2):
        ws.cell(row=row_idx, column=1, value=r["group_name"])
        ws.cell(row=row_idx, column=2, value=r["last_name"])
        ws.cell(row=row_idx, column=3, value=r["first_name"])
        ws.cell(row=row_idx, column=4, value=r["middle_name"] or "")
        ws.cell(row=row_idx, column=5, value=r["subject_name"])
        ws.cell(row=row_idx, column=6, value=r["acad_year"])
        ws.cell(row=row_idx, column=7, value=r["semester"])
        ws.cell(row=row_idx, column=8, value=str(r["grade_type"]))
        ws.cell(row=row_idx, column=9, value=float(r["value"]) if r["value"] is not None else "")
        ws.cell(row=row_idx, column=10, value=str(r["date_recorded"]))

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 3, 40)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=grades.xlsx"},
    )


@router.get("/grades/pdf")
async def grades_pdf(
    group_id: int | None = Query(None),
    subject_id: int | None = Query(None),
    acad_year: str | None = Query(None),
    grade_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    rows = await _get_grade_data(db, group_id, subject_id, acad_year, grade_type)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=1*cm, rightMargin=1*cm)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("title", parent=styles["Heading1"], fontSize=14, spaceAfter=12)
    elements = [Paragraph("Ведомость успеваемости", title_style), Spacer(1, 0.3*cm)]

    table_data = [["Группа", "ФИО", "Дисциплина", "Год", "Сем.", "Тип", "Оценка", "Дата"]]
    for r in rows:
        fio = f"{r['last_name']} {r['first_name']} {r['middle_name'] or ''}".strip()
        table_data.append([
            r["group_name"],
            fio,
            r["subject_name"],
            r["acad_year"],
            str(r["semester"]),
            str(r["grade_type"]),
            str(r["value"]) if r["value"] is not None else "—",
            str(r["date_recorded"]),
        ])

    col_widths = [2.5*cm, 5*cm, 6*cm, 2*cm, 1.5*cm, 2.5*cm, 2*cm, 2.5*cm]
    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4472C4")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#EEF2FF")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("WORDWRAP", (0, 0), (-1, -1), True),
    ]))
    elements.append(t)

    doc.build(elements)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=grades.pdf"},
    )


@router.get("/attendance/excel")
async def attendance_excel(
    group_id: int | None = Query(None),
    assignment_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    query = (
        select(
            Student.last_name,
            Student.first_name,
            Group.name.label("group_name"),
            Subject.name.label("subject_name"),
            Attendance.lesson_date,
            Attendance.is_present,
            Attendance.comment,
        )
        .join(Attendance, Attendance.student_id == Student.id)
        .join(Group, Student.group_id == Group.id)
        .join(TeachingAssignment, Attendance.assignment_id == TeachingAssignment.id)
        .join(Subject, TeachingAssignment.subject_id == Subject.id)
        .order_by(Group.name, Student.last_name, Attendance.lesson_date)
    )
    if group_id:
        query = query.where(TeachingAssignment.group_id == group_id)
    if assignment_id:
        query = query.where(Attendance.assignment_id == assignment_id)

    result = await db.execute(query)
    rows = result.mappings().all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Посещаемость"

    headers = ["Группа", "Фамилия", "Имя", "Дисциплина", "Дата", "Присутствовал", "Комментарий"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="4472C4")
        cell.alignment = Alignment(horizontal="center")

    for row_idx, r in enumerate(rows, 2):
        ws.cell(row=row_idx, column=1, value=r["group_name"])
        ws.cell(row=row_idx, column=2, value=r["last_name"])
        ws.cell(row=row_idx, column=3, value=r["first_name"])
        ws.cell(row=row_idx, column=4, value=r["subject_name"])
        ws.cell(row=row_idx, column=5, value=str(r["lesson_date"]))
        ws.cell(row=row_idx, column=6, value="Да" if r["is_present"] else "Нет")
        ws.cell(row=row_idx, column=7, value=r["comment"] or "")

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 3, 40)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=attendance.xlsx"},
    )
