import client from './client'

export interface GroupSummaryRow {
  subject: string
  acad_year: string
  semester: number
  students_count: number
  avg_grade: number
  min_grade: number
  max_grade: number
  tests_total: number
  tests_passed: number
}

export interface StudentSubjectRow {
  subject: string
  avg_grade: number
  grades_count: number
  min_grade: number
  max_grade: number
}

export interface StudentProgressRow {
  date_recorded: string
  subject: string
  grade_type: string
  value: number
  passed: boolean | null
}

export interface AttendanceRate {
  total: number
  present: number
  absent: number
  rate_pct: number | null
}

export interface AttendanceBySubjectRow {
  subject: string
  total: number
  present: number
  rate_pct: number | null
}

export interface TopStudent {
  id: number
  name: string
  group: string
  avg_grade: number
}

export async function getGroupSummary(groupId: number, acadYear?: string, semester?: number): Promise<GroupSummaryRow[]> {
  const params: Record<string, unknown> = { group_id: groupId }
  if (acadYear) params.acad_year = acadYear
  if (semester) params.semester = semester
  const { data } = await client.get('/analytics/group-summary', { params })
  return data
}

export async function getStudentSubjects(studentId: number): Promise<StudentSubjectRow[]> {
  const { data } = await client.get(`/analytics/student-subjects/${studentId}`)
  return data
}

export async function getStudentProgress(studentId: number, dateFrom?: string, dateTo?: string): Promise<StudentProgressRow[]> {
  const params: Record<string, unknown> = {}
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo
  const { data } = await client.get(`/analytics/student-progress/${studentId}`, { params })
  return data
}

export async function getAttendanceRate(groupId?: number, studentId?: number): Promise<AttendanceRate> {
  const params: Record<string, unknown> = {}
  if (groupId) params.group_id = groupId
  if (studentId) params.student_id = studentId
  const { data } = await client.get('/analytics/attendance-rate', { params })
  return data
}

export async function getGroupAttendanceBySubject(groupId: number): Promise<AttendanceBySubjectRow[]> {
  const { data } = await client.get('/analytics/group-attendance-by-subject', { params: { group_id: groupId } })
  return data
}

export interface GroupRatingRow {
  id: number
  group: string
  avg_grade: number
  students_count: number
  grades_count: number
}

export interface SubjectRatingRow {
  id: number
  subject: string
  avg_grade: number
  students_count: number
  grades_count: number
}

export async function getTopStudents(groupId?: number, limit = 5000): Promise<TopStudent[]> {
  const params: Record<string, unknown> = { limit }
  if (groupId) params.group_id = groupId
  const { data } = await client.get('/analytics/top-students', { params })
  return data
}

export async function getRatingByGroups(): Promise<GroupRatingRow[]> {
  const { data } = await client.get('/analytics/rating/groups')
  return data
}

export async function getRatingBySubjects(): Promise<SubjectRatingRow[]> {
  const { data } = await client.get('/analytics/rating/subjects')
  return data
}

export interface QuestionStat {
  test_question_id: number
  order_index: number
  question_id: number
  question_text: string
  question_type: string
  topic: string | null
  attempts: number
  correct_count: number
  error_rate_pct: number | null
  avg_time_sec: number | null
}

export interface TestDuration {
  test_id: number
  title: string
  subject: string
  attempts: number
  avg_duration_sec: number | null
  min_duration_sec: number | null
  max_duration_sec: number | null
}

export interface TopicMastery {
  topic_id: number
  topic: string
  attempts: number
  correct_count: number
  correct_pct: number | null
}

export interface StudentWeakness {
  student_id: number
  student_name: string
  topic_id: number
  topic: string
  attempts: number
  correct_count: number
  correct_pct: number | null
}

export async function getQuestionStats(testId: number): Promise<QuestionStat[]> {
  const { data } = await client.get('/analytics/question-stats', { params: { test_id: testId } })
  return data
}

export async function getTestDurations(): Promise<TestDuration[]> {
  const { data } = await client.get('/analytics/test-durations')
  return data
}

export async function getTopicMastery(groupId: number): Promise<TopicMastery[]> {
  const { data } = await client.get('/analytics/topic-mastery', { params: { group_id: groupId } })
  return data
}

export async function getStudentWeaknesses(groupId: number, minAttempts = 2): Promise<StudentWeakness[]> {
  const { data } = await client.get('/analytics/student-weaknesses', { params: { group_id: groupId, min_attempts: minAttempts } })
  return data
}
