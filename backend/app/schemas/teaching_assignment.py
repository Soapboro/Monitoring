from pydantic import BaseModel


class TeachingAssignmentCreate(BaseModel):
    teacher_id: int
    subject_id: int
    group_id: int
    semester: int
    acad_year: str
    control_form: str | None = None


class TeachingAssignmentUpdate(BaseModel):
    teacher_id: int | None = None
    subject_id: int | None = None
    group_id: int | None = None
    semester: int | None = None
    acad_year: str | None = None
    control_form: str | None = None


class TeachingAssignmentOut(BaseModel):
    id: int
    teacher_id: int
    subject_id: int
    group_id: int
    semester: int
    acad_year: str
    control_form: str | None = None

    model_config = {"from_attributes": True}
