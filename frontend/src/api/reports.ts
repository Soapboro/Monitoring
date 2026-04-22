function buildQuery(params: Record<string, unknown>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  return parts.length ? '?' + parts.join('&') : ''
}

async function triggerDownload(path: string) {
  const token = localStorage.getItem('token')
  const res = await fetch(`/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Ошибка загрузки: ${res.status}`)
  const cd = res.headers.get('Content-Disposition') ?? ''
  const fname = cd.match(/filename=([^\s;]+)/)?.[1] ?? 'report'
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fname
  a.click()
  URL.revokeObjectURL(url)
}

export interface GradeReportParams {
  group_id?: number
  subject_id?: number
  acad_year?: string
  grade_type?: string
}

export interface AttendanceReportParams {
  group_id?: number
  subject_id?: number
  assignment_id?: number
  date_from?: string
  date_to?: string
}

export interface AnalyticsReportParams {
  group_id?: number
  subject_id?: number
  acad_year?: string
}

export function downloadGradesExcel(params: GradeReportParams) {
  return triggerDownload(`/reports/grades/excel${buildQuery(params as Record<string, unknown>)}`)
}

export function downloadGradesPdf(params: GradeReportParams) {
  return triggerDownload(`/reports/grades/pdf${buildQuery(params as Record<string, unknown>)}`)
}

export function downloadAttendanceExcel(params: AttendanceReportParams) {
  return triggerDownload(`/reports/attendance/excel${buildQuery(params as Record<string, unknown>)}`)
}

export function downloadStudentExcel(studentId: number) {
  return triggerDownload(`/reports/student/excel?student_id=${studentId}`)
}

export function downloadStudentPdf(studentId: number) {
  return triggerDownload(`/reports/student/pdf?student_id=${studentId}`)
}

export function downloadAnalyticsExcel(params: AnalyticsReportParams) {
  return triggerDownload(`/reports/analytics/excel${buildQuery(params as Record<string, unknown>)}`)
}
