import client from './client'

export interface StudentProfile {
  id: number
  user_id: number | null
  last_name: string
  first_name: string
  middle_name: string | null
  group_id: number
  student_num: string | null
  is_active: boolean
}

export interface TeacherProfile {
  id: number
  user_id: number
  last_name: string
  first_name: string
  middle_name: string | null
  position: string | null
  phone: string | null
  department_id: number | null
}

export interface TeachingAssignment {
  id: number
  teacher_id: number
  group_id: number
  subject_id: number
  acad_year: string
  semester: number
}

export interface GradeOut {
  id: number
  student_id: number
  assignment_id: number
  grade_type: string
  value: number | null
  passed: boolean | null
  date_recorded: string
  comment: string | null
  session_id: number | null
  recorded_by: number | null
}

export interface Subject {
  id: number
  name: string
  code: string | null
  hours_total: number | null
  control_form: string | null
  department_id: number | null
}

export interface Department {
  id: number
  name: string
  code: string | null
  description: string | null
}

export interface Group {
  id: number
  name: string
  year_start: number
  department_id: number | null
  is_active: boolean
}

export interface TestSession {
  id: number
  student_id: number
  test_id: number
  status: string
  score_total: number | null
  score_max: number | null
  passed: boolean | null
  started_at: string
  finished_at: string | null
}

export interface AttendanceRecord {
  id: number
  student_id: number
  assignment_id: number
  lesson_date: string
  is_present: boolean
  comment: string | null
}

export type LessonType = 'lecture' | 'practice' | 'lab' | 'seminar' | 'other'

export interface Lesson {
  id: number
  assignment_id: number
  starts_at: string
  ends_at: string
  topic: string | null
  lesson_type: LessonType
  room: string | null
  created_at: string
}

export interface GradeRecord {
  id: number
  student_id: number
  assignment_id: number
  grade_type: string
  value: number | null
  passed: boolean | null
  comment: string | null
  date_recorded: string
  recorded_by: number
}

// --- Admin ---
export const getStudents = () => client.get<StudentProfile[]>('/students').then(r => r.data)
export const getTeachers = () => client.get<TeacherProfile[]>('/teachers').then(r => r.data)
export const getGroups = () => client.get<Group[]>('/groups').then(r => r.data)
export const getSubjects = () => client.get<Subject[]>('/subjects').then(r => r.data)
export const getDepartments = () => client.get<Department[]>('/departments').then(r => r.data)

// User CRUD
export const createUser = (data: { email: string; password: string; role: string }) =>
  client.post('/users', data).then(r => r.data)
export const updateUser = (id: number, data: { email?: string; is_active?: boolean; role?: string }) =>
  client.patch(`/users/${id}`, data).then(r => r.data)
export const deleteUser = (id: number) => client.delete(`/users/${id}`)

// Department CRUD
export const createDepartment = (data: { name: string; code?: string; description?: string }) =>
  client.post<Department>('/departments', data).then(r => r.data)
export const updateDepartment = (id: number, data: { name?: string; code?: string; description?: string }) =>
  client.patch<Department>(`/departments/${id}`, data).then(r => r.data)
export const deleteDepartment = (id: number) => client.delete(`/departments/${id}`)

// Subject CRUD
export const createSubject = (data: { name: string; code?: string; hours_total?: number; control_form?: string; department_id?: number }) =>
  client.post<Subject>('/subjects', data).then(r => r.data)
export const updateSubject = (id: number, data: { name?: string; code?: string; hours_total?: number; control_form?: string; department_id?: number | null }) =>
  client.patch<Subject>(`/subjects/${id}`, data).then(r => r.data)
export const deleteSubject = (id: number) => client.delete(`/subjects/${id}`)

// Group CRUD
export const createGroup = (data: { name: string; year_start: number; department_id?: number; is_active?: boolean }) =>
  client.post<Group>('/groups', data).then(r => r.data)
export const updateGroup = (id: number, data: { name?: string; year_start?: number; department_id?: number | null; is_active?: boolean }) =>
  client.patch<Group>(`/groups/${id}`, data).then(r => r.data)
export const deleteGroup = (id: number) => client.delete(`/groups/${id}`)

// Student group transfer
export const transferStudent = (studentId: number, groupId: number) =>
  client.patch(`/students/${studentId}`, { group_id: groupId }).then(r => r.data)

export const getAllStudents = () => client.get<StudentProfile[]>('/students').then(r => r.data)
export const getAllTeachers = () => client.get<TeacherProfile[]>('/teachers').then(r => r.data)

// Teacher department binding
export const setTeacherDepartment = (teacherId: number, departmentId: number | null) =>
  client.patch<TeacherProfile>(`/teachers/${teacherId}`, { department_id: departmentId }).then(r => r.data)

// Lesson CRUD
export const getLessons = (params?: { teacher_id?: number; assignment_id?: number; date_from?: string; date_to?: string }) =>
  client.get<Lesson[]>('/lessons', { params }).then(r => r.data)
export const getLesson = (id: number) => client.get<Lesson>(`/lessons/${id}`).then(r => r.data)
export const createLesson = (data: { assignment_id: number; starts_at: string; ends_at: string; topic?: string; lesson_type?: LessonType; room?: string }) =>
  client.post<Lesson>('/lessons', data).then(r => r.data)
export const updateLesson = (id: number, data: { starts_at?: string; ends_at?: string; topic?: string; lesson_type?: LessonType; room?: string }) =>
  client.patch<Lesson>(`/lessons/${id}`, data).then(r => r.data)
export const deleteLesson = (id: number) => client.delete(`/lessons/${id}`)

// Bulk attendance
export const bulkAttendance = (data: { assignment_id: number; lesson_date: string; records: { student_id: number; is_present: boolean; comment?: string }[] }) =>
  client.post<AttendanceRecord[]>('/attendance/bulk', data).then(r => r.data)
export const updateAttendance = (id: number, data: { is_present?: boolean; comment?: string }) =>
  client.patch<AttendanceRecord>(`/attendance/${id}`, data).then(r => r.data)

// Grades
export const createGrade = (data: { student_id: number; assignment_id: number; grade_type: string; value?: number; passed?: boolean; comment?: string; date_recorded?: string }) =>
  client.post<GradeRecord>('/grades', data).then(r => r.data)
export const updateGrade = (id: number, data: { value?: number; passed?: boolean; comment?: string }) =>
  client.patch<GradeRecord>(`/grades/${id}`, data).then(r => r.data)
export const deleteGrade = (id: number) => client.delete(`/grades/${id}`)

// --- Teacher ---
export const getMyTeacherProfile = () => client.get<TeacherProfile>('/teachers/me').then(r => r.data)
export const getAssignments = (teacherId: number) =>
  client.get<TeachingAssignment[]>('/teaching-assignments', { params: { teacher_id: teacherId } }).then(r => r.data)

// --- Student ---
export const getMyStudentProfile = () => client.get<StudentProfile>('/students/me/profile').then(r => r.data)
export const getMyGrades = () => client.get<GradeOut[]>('/students/me/grades').then(r => r.data)
export const getMySessions = () => client.get<TestSession[]>('/students/me/sessions').then(r => r.data)
export const getMyAttendance = () => client.get<AttendanceRecord[]>('/students/me/attendance').then(r => r.data)
