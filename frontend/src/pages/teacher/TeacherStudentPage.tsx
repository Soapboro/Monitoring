import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import type { StudentProfile, TeachingAssignment, Subject, GradeRecord, AttendanceRecord } from '../../api/resources'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TestSession {
  id: number
  test_id: number
  student_id: number
  attempt_number: number
  status: string
  started_at: string
  finished_at: string | null
  score_total: number | null
  score_max: number | null
  passed: boolean | null
}

interface TestInfo {
  id: number
  title: string
  subject_id: number
  attempts_allowed: number
  passing_score_pct: number
  status: string
}

interface AssignmentWithSubject extends TeachingAssignment {
  subjectName: string
}

// ── Grade type labels ──────────────────────────────────────────────────────────

const GRADE_TYPE_LABELS: Record<string, string> = {
  current: 'Текущая', thematic: 'Тематическая', midterm: 'Промежуточная',
  final: 'Итоговая', attendance: 'За посещ.',
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TeacherStudentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const studentId = Number(id)

  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [groupName, setGroupName] = useState('')
  const [assignments, setAssignments] = useState<AssignmentWithSubject[]>([])
  const [grades, setGrades] = useState<GradeRecord[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [sessions, setSessions] = useState<TestSession[]>([])
  const [tests, setTests] = useState<Record<number, TestInfo>>({})
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState<number | null>(null)
  const [resetMsg, setResetMsg] = useState<Record<number, string>>({})

  const load = async () => {
    setLoading(true)
    try {
      const [teacherProfile, studentData] = await Promise.all([
        getMyTeacherProfile(),
        client.get<StudentProfile>(`/students/${studentId}`).then(r => r.data),
      ])
      setStudent(studentData)

      const [teacherAssignments, groupData] = await Promise.all([
        getAssignments(teacherProfile.id),
        client.get<{ id: number; name: string }>(`/groups/${studentData.group_id}`).then(r => r.data),
      ])
      setGroupName(groupData.name)

      // Filter to assignments for this student's group
      const myAssignments = teacherAssignments.filter(a => a.group_id === studentData.group_id)

      // Load subject names
      const subjectIds = [...new Set(myAssignments.map(a => a.subject_id))]
      const subjectMap: Record<number, string> = {}
      await Promise.all(subjectIds.map(async sid => {
        const s = await client.get<Subject>(`/subjects/${sid}`).then(r => r.data)
        subjectMap[sid] = s.name
      }))

      const enriched: AssignmentWithSubject[] = myAssignments.map(a => ({
        ...a,
        subjectName: subjectMap[a.subject_id] ?? '—',
      }))
      setAssignments(enriched)

      // Load grades and attendance in parallel for all assignments
      const [allGrades, allAtt, rawSessions] = await Promise.all([
        Promise.all(myAssignments.map(a =>
          client.get<GradeRecord[]>('/grades', {
            params: { assignment_id: a.id, student_id: studentId },
          }).then(r => r.data)
        )).then(arrays => arrays.flat()),
        Promise.all(myAssignments.map(a =>
          client.get<AttendanceRecord[]>('/attendance', {
            params: { assignment_id: a.id, student_id: studentId },
          }).then(r => r.data)
        )).then(arrays => arrays.flat()),
        client.get<TestSession[]>(`/sessions/student/${studentId}`).then(r => r.data),
      ])

      setGrades(allGrades.sort((a, b) => b.date_recorded.localeCompare(a.date_recorded)))
      setAttendance(allAtt.sort((a, b) => b.lesson_date.localeCompare(a.lesson_date)))
      setSessions(rawSessions)

      // Load test info for each unique test_id
      const testIds = [...new Set(rawSessions.map(s => s.test_id))]
      const testMap: Record<number, TestInfo> = {}
      await Promise.all(testIds.map(async tid => {
        try {
          const t = await client.get<TestInfo>(`/tests/${tid}`).then(r => r.data)
          testMap[tid] = t
        } catch { /* silent */ }
      }))
      setTests(testMap)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [studentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset test attempts ────────────────────────────────────────────────────

  const handleResetTest = async (testId: number) => {
    setResetting(testId)
    try {
      await client.delete(`/sessions/student/${studentId}/test/${testId}/reset`)
      setResetMsg(prev => ({ ...prev, [testId]: 'Попытки сброшены — студент может пройти заново' }))
      setTimeout(() => setResetMsg(prev => { const n = {...prev}; delete n[testId]; return n }), 4000)
      await load()
    } finally {
      setResetting(null)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const presentCount = attendance.filter(a => a.is_present).length
  const attendRate = attendance.length > 0 ? Math.round(presentCount / attendance.length * 100) : null

  // Group sessions by test_id (latest attempt per test for summary)
  const sessionsByTest: Record<number, TestSession[]> = {}
  for (const s of sessions) {
    if (!sessionsByTest[s.test_id]) sessionsByTest[s.test_id] = []
    sessionsByTest[s.test_id].push(s)
  }

  if (loading) return <Spinner />
  if (!student) return <div className="p-8 text-slate-400">Студент не найден</div>

  const fullName = [student.last_name, student.first_name, student.middle_name].filter(Boolean).join(' ')

  return (
    <div className="p-8 max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-400 mb-2">
        <button onClick={() => navigate('/analytics')} className="hover:text-blue-600 transition-colors cursor-pointer">
          Аналитика
        </button>
        <ChevronIcon />
        <span className="text-slate-600 font-medium">{fullName}</span>
      </nav>

      {/* Student header card */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-xl font-bold text-blue-600">{student.last_name[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-slate-800">{fullName}</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {groupName}
              {student.student_num ? ` · № ${student.student_num}` : ''}
            </p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
          <StatCard label="Предметов" value={assignments.length} />
          <StatCard
            label="Средний балл"
            value={grades.length > 0
              ? (grades.reduce((s, g) => s + (g.value ?? 0), 0) / grades.filter(g => g.value != null).length).toFixed(2)
              : '—'}
            color={
              grades.filter(g => g.value != null).length > 0
                ? (grades.reduce((s, g) => s + (g.value ?? 0), 0) / grades.filter(g => g.value != null).length) >= 4
                  ? 'text-emerald-600' : 'text-amber-500'
                : 'text-slate-500'
            }
          />
          <StatCard
            label="Посещаемость"
            value={attendRate !== null ? `${attendRate}%` : '—'}
            color={attendRate !== null ? (attendRate >= 75 ? 'text-emerald-600' : attendRate >= 50 ? 'text-amber-500' : 'text-red-500') : 'text-slate-500'}
          />
          <StatCard label="Тестов пройдено" value={sessions.filter(s => s.status === 'completed').length} />
        </div>
      </div>

      {/* ── Subjects & attendance by subject ── */}
      {assignments.length > 0 && (
        <Section title="Дисциплины" count={assignments.length}>
          <div className="grid grid-cols-2 gap-3 p-4">
            {assignments.map(a => {
              const aGrades = grades.filter(g => g.assignment_id === a.id && g.value != null)
              const aAtt = attendance.filter(att => att.assignment_id === a.id)
              const avgGrade = aGrades.length > 0
                ? (aGrades.reduce((s, g) => s + g.value!, 0) / aGrades.length).toFixed(2)
                : null
              const attRate = aAtt.length > 0
                ? Math.round(aAtt.filter(att => att.is_present).length / aAtt.length * 100)
                : null
              return (
                <div key={a.id} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                  <p className="font-medium text-slate-800 text-sm mb-2">{a.subjectName}</p>
                  <p className="text-xs text-slate-400">{a.acad_year} · сем. {a.semester}</p>
                  <div className="flex gap-4 mt-2">
                    <div>
                      <p className="text-xs text-slate-400">Ср. балл</p>
                      <p className={`text-sm font-bold ${avgGrade ? (Number(avgGrade) >= 4 ? 'text-emerald-600' : 'text-amber-500') : 'text-slate-400'}`}>
                        {avgGrade ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Посещ.</p>
                      <p className={`text-sm font-bold ${attRate !== null ? (attRate >= 75 ? 'text-emerald-600' : 'text-amber-500') : 'text-slate-400'}`}>
                        {attRate !== null ? `${attRate}%` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Оценок</p>
                      <p className="text-sm font-bold text-slate-600">{aGrades.length}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* ── Grades ── */}
      <Section title="Оценки" count={grades.length}>
        {grades.length === 0 ? (
          <EmptyRow text="Оценок нет" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Дата</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Предмет</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Тип</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Оценка</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Комментарий</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {grades.map(g => {
                const a = assignments.find(a => a.id === g.assignment_id)
                return (
                  <tr key={g.id} className="hover:bg-slate-50">
                    <td className="px-6 py-2.5 text-slate-500 whitespace-nowrap">
                      {String(g.date_recorded).slice(0, 10)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{a?.subjectName ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {GRADE_TYPE_LABELS[g.grade_type] ?? g.grade_type}
                    </td>
                    <td className="px-6 py-2.5 text-right">
                      {g.value != null ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          g.value >= 4 ? 'bg-emerald-100 text-emerald-700' :
                          g.value >= 3 ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-700'
                        }`}>{g.value}</span>
                      ) : g.passed != null ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          g.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>{g.passed ? 'Зачёт' : 'Незачёт'}</span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{g.comment ?? ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* ── Attendance ── */}
      <Section title="Посещаемость" count={attendance.length}>
        {attendance.length === 0 ? (
          <EmptyRow text="Записей о посещаемости нет" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Дата</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Предмет</th>
                <th className="text-center px-4 py-3 text-slate-500 font-medium">Присутствие</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Комментарий</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {attendance.map(a => {
                const asgn = assignments.find(x => x.id === a.assignment_id)
                return (
                  <tr key={a.id} className={a.is_present ? 'hover:bg-slate-50' : 'bg-red-50/30 hover:bg-red-50/50'}>
                    <td className="px-6 py-2.5 text-slate-500 whitespace-nowrap">
                      {String(a.lesson_date).slice(0, 10)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{asgn?.subjectName ?? '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        a.is_present ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {a.is_present ? 'Присутствовал' : 'Отсутствовал'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{a.comment ?? ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* ── Tests ── */}
      <Section title="Тесты" count={Object.keys(sessionsByTest).length}>
        {Object.keys(sessionsByTest).length === 0 ? (
          <EmptyRow text="Тестов нет" />
        ) : (
          <div className="divide-y divide-slate-50">
            {Object.entries(sessionsByTest).map(([testIdStr, testSessions]) => {
              const testId = Number(testIdStr)
              const test = tests[testId]
              const latest = testSessions[0]
              const completed = testSessions.filter(s => s.status === 'completed')
              const inProgress = testSessions.find(s => s.status === 'in_progress')

              const pct = latest.score_total != null && latest.score_max != null && latest.score_max > 0
                ? Math.round(latest.score_total / latest.score_max * 100)
                : null

              return (
                <div key={testId} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 mb-1">
                        {test?.title ?? `Тест #${testId}`}
                      </p>
                      <p className="text-xs text-slate-400 mb-2">
                        Попыток: {testSessions.length}
                        {test ? ` / ${test.attempts_allowed} разрешено` : ''}
                        {test ? ` · Проходной балл: ${test.passing_score_pct}%` : ''}
                      </p>

                      {/* Sessions list */}
                      <div className="space-y-1.5">
                        {testSessions.map(s => {
                          const sPct = s.score_total != null && s.score_max != null && s.score_max > 0
                            ? Math.round(s.score_total / s.score_max * 100) : null
                          return (
                            <div key={s.id} className="flex items-center gap-3 text-xs">
                              <span className="text-slate-400 w-20 shrink-0">
                                Попытка {s.attempt_number}
                              </span>
                              <StatusBadge status={s.status} passed={s.passed} />
                              {s.status === 'completed' && sPct !== null && (
                                <span className="text-slate-600 font-medium">
                                  {s.score_total?.toFixed(1)} / {s.score_max?.toFixed(1)} ({sPct}%)
                                </span>
                              )}
                              {s.status === 'in_progress' && (
                                <span className="text-blue-500">В процессе</span>
                              )}
                              <span className="text-slate-400">
                                {new Date(s.started_at).toLocaleDateString('ru-RU')}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Reset button */}
                    <div className="shrink-0 text-right">
                      {resetMsg[testId] ? (
                        <p className="text-xs text-emerald-600 max-w-48 text-right">{resetMsg[testId]}</p>
                      ) : (
                        <button
                          onClick={() => handleResetTest(testId)}
                          disabled={resetting === testId}
                          className="px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          {resetting === testId ? 'Сброс...' : 'Выдать заново'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-700">{title}</h2>
        {count > 0 && <span className="text-xs text-slate-400">{count}</span>}
      </div>
      {children}
    </div>
  )
}

function StatCard({ label, value, color = 'text-slate-800' }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function StatusBadge({ status, passed }: { status: string; passed: boolean | null }) {
  if (status === 'completed') {
    return passed === true
      ? <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Сдал</span>
      : passed === false
      ? <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">Не сдал</span>
      : <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">Завершён</span>
  }
  if (status === 'in_progress') {
    return <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-semibold">В процессе</span>
  }
  return <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">{status}</span>
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-6 py-8 text-center text-slate-400 text-sm">{text}</p>
}

function ChevronIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
}

function Spinner() {
  return <div className="p-8 flex items-center gap-3 text-slate-400">
    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    Загрузка...
  </div>
}
