import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import type { StudentProfile, GradeOut, AttendanceRecord, TestSession } from '../../api/resources'

interface SubjectData {
  id: number
  name: string
  grades: GradeOut[]
  attendance: AttendanceRecord[]
}

const GRADE_TYPE_LABELS: Record<string, string> = {
  current: 'Текущая', midterm: 'Промежуточная', final: 'Итоговая',
  test: 'Тест', exam: 'Экзамен', credit: 'Зачёт',
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [groupName, setGroupName] = useState('')
  const [subjects, setSubjects] = useState<SubjectData[]>([])
  const [sessions, setSessions] = useState<TestSession[]>([])
  const [expandedSubject, setExpandedSubject] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    async function init() {
      try {
        const [s, gr, att, sess] = await Promise.all([
          client.get<StudentProfile>(`/students/${id}`).then(r => r.data),
          client.get<GradeOut[]>('/grades', { params: { student_id: id } }).then(r => r.data),
          client.get<AttendanceRecord[]>('/attendance', { params: { student_id: id } }).then(r => r.data),
          client.get<TestSession[]>('/test-sessions', { params: { student_id: id } }).then(r => r.data).catch(() => []),
        ])
        setStudent(s)
        setSessions(sess)

        const gRes = await client.get<{ name: string }>(`/groups/${s.group_id}`)
        setGroupName(gRes.data.name)

        // Build assignment → subject map
        const assignmentIds = [...new Set([...gr.map(g => g.assignment_id), ...att.map(a => a.assignment_id)])]
        const assignToSubject: Record<number, { id: number; name: string }> = {}
        await Promise.all(assignmentIds.map(async (aid) => {
          try {
            const a = await client.get<{ subject_id: number }>(`/teaching-assignments/${aid}`)
            const subj = await client.get<{ id: number; name: string }>(`/subjects/${a.data.subject_id}`)
            assignToSubject[aid] = { id: subj.data.id, name: subj.data.name }
          } catch { assignToSubject[aid] = { id: aid, name: `Предмет #${aid}` } }
        }))

        // Group by subject_id
        const subjectMap: Record<number, SubjectData> = {}
        for (const g of gr) {
          const subj = assignToSubject[g.assignment_id]
          if (!subj) continue
          if (!subjectMap[subj.id]) subjectMap[subj.id] = { id: subj.id, name: subj.name, grades: [], attendance: [] }
          subjectMap[subj.id].grades.push(g)
        }
        for (const a of att) {
          const subj = assignToSubject[a.assignment_id]
          if (!subj) continue
          if (!subjectMap[subj.id]) subjectMap[subj.id] = { id: subj.id, name: subj.name, grades: [], attendance: [] }
          subjectMap[subj.id].attendance.push(a)
        }
        const subjList = Object.values(subjectMap).sort((a, b) => a.name.localeCompare(b.name))
        setSubjects(subjList)
        if (subjList.length > 0) setExpandedSubject(subjList[0].id)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [id])

  if (loading) return <Spinner />
  if (!student) return <div className="p-8 text-slate-400">Студент не найден</div>

  const fullName = `${student.last_name} ${student.first_name}${student.middle_name ? ' ' + student.middle_name : ''}`
  const allGrades = subjects.flatMap(s => s.grades)
  const allAttendance = subjects.flatMap(s => s.attendance)
  const presentCount = allAttendance.filter(a => a.is_present).length
  const attendanceRate = allAttendance.length > 0 ? Math.round(presentCount / allAttendance.length * 100) : null
  const numericGrades = allGrades.filter(g => g.value !== null)
  const avgGrade = numericGrades.length > 0
    ? (numericGrades.reduce((s, g) => s + (g.value ?? 0), 0) / numericGrades.length).toFixed(2)
    : null
  const passedSessions = sessions.filter(s => s.status === 'completed' && s.passed === true)
  const failedSessions = sessions.filter(s => s.status === 'completed' && s.passed === false)
  const inProgressSessions = sessions.filter(s => s.status !== 'completed')

  return (
    <div className="p-8 max-w-5xl">
      {/* Хлебные крошки */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-400 mb-6">
        <button onClick={() => navigate('/groups')} className="hover:text-blue-600 cursor-pointer transition-colors">Группы</button>
        <Chevron />
        <button onClick={() => navigate(`/groups/${student.group_id}`)} className="hover:text-blue-600 cursor-pointer transition-colors">{groupName}</button>
        <Chevron />
        <span className="text-slate-600 font-medium">{student.last_name} {student.first_name}</span>
      </nav>

      {/* Шапка */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-lg font-semibold text-blue-600">{student.last_name[0]}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-slate-800">{fullName}</h1>
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={() => navigate(`/groups/${student.group_id}`)}
                className="text-sm text-blue-600 hover:underline cursor-pointer"
              >
                {groupName}
              </button>
              {student.student_num && (
                <span className="text-slate-400 text-sm">· №{student.student_num}</span>
              )}
            </div>
          </div>
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
            student.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {student.is_active ? 'Активен' : 'Неактивен'}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
          <Stat label="Средний балл" value={avgGrade ?? '—'} />
          <Stat label="Оценок" value={numericGrades.length} />
          <Stat label="Посещаемость" value={attendanceRate !== null ? `${attendanceRate}%` : '—'} />
          <Stat label="Тестов пройдено" value={`${passedSessions.length} / ${sessions.length}`} />
        </div>
      </div>

      {/* Предметы */}
      <Section title="Предметы" subtitle={`${subjects.length} дисциплин`}>
        {subjects.length === 0 ? (
          <Empty text="Нет данных по предметам" />
        ) : (
          <div className="space-y-2">
            {subjects.map(subj => {
              const present = subj.attendance.filter(a => a.is_present).length
              const rate = subj.attendance.length > 0 ? Math.round(present / subj.attendance.length * 100) : null
              const nums = subj.grades.filter(g => g.value !== null)
              const avg = nums.length > 0
                ? (nums.reduce((s, g) => s + (g.value ?? 0), 0) / nums.length).toFixed(1)
                : null
              const isOpen = expandedSubject === subj.id
              const recentGrades = [...subj.grades]
                .sort((a, b) => b.date_recorded.localeCompare(a.date_recorded))
                .slice(0, 5)

              return (
                <div key={subj.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedSubject(isOpen ? null : subj.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="font-medium text-slate-800 text-sm">{subj.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {avg !== null && (
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          Number(avg) >= 4 ? 'bg-emerald-100 text-emerald-700' :
                          Number(avg) >= 3 ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-700'
                        }`}>ср. {avg}</span>
                      )}
                      {rate !== null && (
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          rate >= 75 ? 'bg-emerald-100 text-emerald-700' :
                          rate >= 50 ? 'bg-amber-100 text-amber-600' :
                          'bg-red-100 text-red-600'
                        }`}>{rate}% посещ.</span>
                      )}
                      <span className="text-xs text-slate-400">{subj.grades.length} оц. · {subj.attendance.length} зан.</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100 px-5 py-4 grid grid-cols-2 gap-6">
                      {/* Посещаемость */}
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Посещаемость</p>
                        {subj.attendance.length === 0 ? (
                          <p className="text-xs text-slate-400">Нет записей</p>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Всего занятий</span>
                              <span className="font-medium text-slate-700">{subj.attendance.length}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Присутствовал</span>
                              <span className="font-medium text-emerald-600">{present}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Отсутствовал</span>
                              <span className="font-medium text-red-500">{subj.attendance.length - present}</span>
                            </div>
                            {rate !== null && (
                              <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${rate >= 75 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                  style={{ width: `${rate}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Последние оценки */}
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                          Последние оценки {subj.grades.length > 5 ? `(из ${subj.grades.length})` : ''}
                        </p>
                        {recentGrades.length === 0 ? (
                          <p className="text-xs text-slate-400">Нет оценок</p>
                        ) : (
                          <div className="space-y-1.5">
                            {recentGrades.map(g => (
                              <div key={g.id} className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">{String(g.date_recorded).slice(0, 10)} · {GRADE_TYPE_LABELS[g.grade_type] ?? g.grade_type}</span>
                                {g.value !== null ? (
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    g.value >= 4 ? 'bg-emerald-100 text-emerald-700' :
                                    g.value >= 3 ? 'bg-blue-100 text-blue-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>{g.value}</span>
                                ) : g.passed !== null ? (
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    g.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                  }`}>{g.passed ? 'Зачёт' : 'Незачёт'}</span>
                                ) : <span className="text-slate-400">—</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* Тесты */}
      <Section title="Тесты" subtitle={`${sessions.length} сессий`} className="mt-6">
        {sessions.length === 0 ? (
          <Empty text="Тестов нет" />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* Пройденные */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                  Пройдено ({passedSessions.length})
                </p>
              </div>
              {passedSessions.length === 0 ? (
                <p className="px-4 py-4 text-xs text-slate-400">Нет пройденных тестов</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {passedSessions.map(s => {
                    const pct = s.score_max && s.score_max > 0 ? Math.round((s.score_total ?? 0) / s.score_max * 100) : null
                    return (
                      <div key={s.id} className="px-4 py-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-700">Тест #{s.test_id}</p>
                          <p className="text-xs text-slate-400">{s.started_at.slice(0, 10)}</p>
                        </div>
                        <div className="text-right">
                          {pct !== null && (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                              pct >= 75 ? 'bg-emerald-100 text-emerald-700' :
                              pct >= 50 ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>{pct}%</span>
                          )}
                          {s.score_total !== null && s.score_max !== null && (
                            <p className="text-xs text-slate-400 mt-0.5">{s.score_total}/{s.score_max}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Не пройденные / в процессе */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                  Не пройдено ({failedSessions.length + inProgressSessions.length})
                </p>
              </div>
              {failedSessions.length + inProgressSessions.length === 0 ? (
                <p className="px-4 py-4 text-xs text-slate-400">Все тесты пройдены</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {[...failedSessions, ...inProgressSessions].map(s => {
                    const pct = s.score_max && s.score_max > 0 ? Math.round((s.score_total ?? 0) / s.score_max * 100) : null
                    return (
                      <div key={s.id} className="px-4 py-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-700">Тест #{s.test_id}</p>
                          <p className="text-xs text-slate-400">{s.started_at.slice(0, 10)}</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            s.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'
                          }`}>
                            {s.status === 'in_progress' ? 'В процессе' : 'Не сдан'}
                          </span>
                          {pct !== null && (
                            <p className="text-xs text-slate-400 mt-0.5">{s.score_total}/{s.score_max}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({ title, subtitle, children, className = '' }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-base font-semibold text-slate-700">{title}</h2>
        {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-xl font-bold text-slate-800 mt-0.5">{value}</p>
    </div>
  )
}

function Chevron() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}
function Spinner() {
  return (
    <div className="p-8 flex items-center gap-3 text-slate-400">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      Загрузка...
    </div>
  )
}
function Empty({ text }: { text: string }) {
  return <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400 shadow-sm text-sm">{text}</div>
}
