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
}

// --- Admin ---
export const getStudents = () => client.get<StudentProfile[]>('/students').then(r => r.data)
export const getTeachers = () => client.get<TeacherProfile[]>('/teachers').then(r => r.data)
export const getGroups = () => client.get<{ id: number; name: string }[]>('/groups').then(r => r.data)
export const getSubjects = () => client.get<{ id: number; name: string }[]>('/subjects').then(r => r.data)

// --- Teacher ---
export const getMyTeacherProfile = () => client.get<TeacherProfile>('/teachers/me').then(r => r.data)
export const getAssignments = (teacherId: number) =>
  client.get<TeachingAssignment[]>('/teaching-assignments', { params: { teacher_id: teacherId } }).then(r => r.data)

// --- Student ---
export const getMyStudentProfile = () => client.get<StudentProfile>('/students/me/profile').then(r => r.data)
export const getMyGrades = () => client.get<GradeOut[]>('/students/me/grades').then(r => r.data)
export const getMySessions = () => client.get<TestSession[]>('/students/me/sessions').then(r => r.data)
export const getMyAttendance = () => client.get<AttendanceRecord[]>('/students/me/attendance').then(r => r.data)
