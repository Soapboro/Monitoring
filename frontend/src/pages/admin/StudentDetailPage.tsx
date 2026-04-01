import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import type { StudentProfile, GradeOut, AttendanceRecord, TestSession } from '../../api/resources'

type Tab = 'grades' | 'attendance' | 'tests' | 'adaptive'

interface SubjectMap { [assignmentId: number]: string }
interface AdaptiveRow {
  topic_id: number; topic: string; subject: string
  mastery_level: number; recommended_difficulty: number
}

const GRADE_TYPE_LABELS: Record<string, string> = {
  current: 'Текущая', midterm: 'Промежуточная', final: 'Итоговая', test: 'Тест',
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [groupName, setGroupName] = useState('')
  const [tab, setTab] = useState<Tab>('grades')
  const [grades, setGrades] = useState<GradeOut[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [sessions, setSessions] = useState<TestSession[]>([])
  const [adaptive, setAdaptive] = useState<AdaptiveRow[]>([])
  const [subjectMap, setSubjectMap] = useState<SubjectMap>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    async function init() {
      try {
        const [s, gr, att, sess] = await Promise.all([
          client.get<StudentProfile>(`/students/${id}`).then(r => r.data),
          client.get<GradeOut[]>('/grades', { params: { student_id: id } }).then(r => r.data),
          client.get<AttendanceRecord[]>('/attendance', { params: { student_id: id } }).then(r => r.data),
          client.get<TestSession[]>('/test-sessions', { params: { student_id: id } }).then(r => r.data),
        ])
        setStudent(s)
        setGrades(gr)
        setAttendance(att)
        setSessions(sess)

        // Имя группы
        const gRes = await client.get<{ name: string }>(`/groups/${s.group_id}`)
        setGroupName(gRes.data.name)

        // Карта assignment_id → subject name
        const assignmentIds = [...new Set([...gr.map(g => g.assignment_id), ...att.map(a => a.assignment_id)])]
        const map: SubjectMap = {}
        await Promise.all(assignmentIds.map(async (aid) => {
          try {
            const a = await client.get<{ subject_id: number }>(`/teaching-assignments/${aid}`)
            const subj = await client.get<{ name: string }>(`/subjects/${a.data.subject_id}`)
            map[aid] = subj.data.name
          } catch { map[aid] = `Предмет #${aid}` }
        }))
        setSubjectMap(map)

        // Адаптивные (если есть user_id)
        if (s.user_id) {
          const adRes = await client.get<AdaptiveRow[]>(`/students/me/adaptive`).catch(() => ({ data: [] }))
          // Adaptive endpoint работает через /me, для преподавателя/админа используем student_id
          const adRes2 = await client.get<AdaptiveRow[]>(`/analytics/student-subjects/${id}`).catch(() => ({ data: [] }))
          setAdaptive(adRes2.data as unknown as AdaptiveRow[])
        }
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

  const fullName = `${student.last_name} ${student.first_name} ${student.middle_name ?? ''}`
  const presentCount = attendance.filter(a => a.is_present).length
  const attendanceRate = attendance.length > 0 ? Math.round(presentCount / attendance.length * 100) : null
  const completedSessions = sessions.filter(s => s.status === 'completed')
  const avgGrade = grades.filter(g => g.value !== null).length > 0
    ? (grades.filter(g => g.value !== null).reduce((s, g) => s + (g.value ?? 0), 0) / grades.filter(g => g.value !== null).length).toFixed(2)
    : null

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'grades', label: 'Оценки', count: grades.length },
    { key: 'attendance', label: 'Посещаемость', count: attendance.length },
    { key: 'tests', label: 'Тесты', count: sessions.length },
    { key: 'adaptive', label: 'Рекомендации', count: adaptive.length },
  ]

  return (
    <div className="p-8 max-w-5xl">
      {/* Хлебные крошки */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-400 mb-6">
        <button onClick={() => navigate('/groups')} className="hover:text-blue-600 cursor-pointer transition-colors">Группы</button>
        <Chevron />
        <button onClick={() => navigate(-1)} className="hover:text-blue-600 cursor-pointer transition-colors">{groupName}</button>
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
            <p className="text-slate-400 text-sm mt-0.5">
              {groupName} {student.student_num ? `· №${student.student_num}` : ''}
            </p>
          </div>
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
            student.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {student.is_active ? 'Активен' : 'Неактивен'}
          </span>
        </div>

        {/* Мини-статистика */}
        <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
          <Stat label="Средний балл" value={avgGrade ?? '—'} />
          <Stat label="Оценок" value={grades.filter(g => g.value !== null).length} />
          <Stat label="Посещаемость" value={attendanceRate !== null ? `${attendanceRate}%` : '—'} />
          <Stat label="Тестов пройдено" value={completedSessions.length} />
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`ml-1.5 text-xs ${tab === t.key ? 'text-blue-600' : 'text-slate-400'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Контент вкладок */}
      {tab === 'grades' && (
        <GradesTab grades={grades} subjectMap={subjectMap} />
      )}
      {tab === 'attendance' && (
        <AttendanceTab attendance={attendance} subjectMap={subjectMap} />
      )}
      {tab === 'tests' && (
        <TestsTab sessions={sessions} />
      )}
      {tab === 'adaptive' && (
        <AdaptiveTab rows={adaptive} studentId={Number(id)} />
      )}
    </div>
  )
}

// --- Вкладка оценок ---
function GradesTab({ grades, subjectMap }: { grades: GradeOut[]; subjectMap: SubjectMap }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  if (grades.length === 0) return <Empty text="Оценок нет" />
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-6 py-3 text-slate-500 font-medium">Предмет</th>
            <th className="text-left px-4 py-3 text-slate-500 font-medium">Тип</th>
            <th className="text-left px-4 py-3 text-slate-500 font-medium">Дата</th>
            <th className="text-right px-6 py-3 text-slate-500 font-medium">Оценка</th>
          </tr>
        </thead>
        <tbody>
          {grades.map(g => (
            <>
              <tr
                key={g.id}
                onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                className="border-t border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-3 text-slate-700">{subjectMap[g.assignment_id] ?? `#${g.assignment_id}`}</td>
                <td className="px-4 py-3 text-slate-500">{GRADE_TYPE_LABELS[g.grade_type] ?? g.grade_type}</td>
                <td className="px-4 py-3 text-slate-500">{String(g.date_recorded).slice(0, 10)}</td>
                <td className="px-6 py-3 text-right">
                  {g.value !== null ? (
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      g.value >= 4 ? 'bg-emerald-100 text-emerald-700' :
                      g.value >= 3 ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>{g.value}</span>
                  ) : <span className="text-slate-400">—</span>}
                </td>
              </tr>
              {expanded === g.id && (
                <tr key={`${g.id}-detail`} className="bg-blue-50 border-t border-blue-100">
                  <td colSpan={4} className="px-6 py-3">
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <p className="text-slate-400 mb-0.5">Зачёт</p>
                        <p className="font-medium text-slate-700">
                          {g.passed === true ? 'Сдано' : g.passed === false ? 'Не сдано' : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-0.5">Комментарий</p>
                        <p className="font-medium text-slate-700">{g.comment || '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-0.5">Сессия теста</p>
                        <p className="font-medium text-slate-700">{g.session_id ? `#${g.session_id}` : '—'}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- Вкладка посещаемости ---
function AttendanceTab({ attendance, subjectMap }: { attendance: AttendanceRecord[]; subjectMap: SubjectMap }) {
  if (attendance.length === 0) return <Empty text="Записей о посещаемости нет" />
  const present = attendance.filter(a => a.is_present).length
  const rate = Math.round(present / attendance.length * 100)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Всего занятий" value={attendance.length} />
        <StatCard label="Присутствовал" value={present} color="text-emerald-600" />
        <StatCard label="Посещаемость" value={`${rate}%`} color={rate >= 75 ? 'text-emerald-600' : 'text-amber-500'} />
      </div>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Дата</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Предмет</th>
              <th className="text-right px-6 py-3 text-slate-500 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {attendance.map(a => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 text-slate-500">{String(a.lesson_date).slice(0, 10)}</td>
                <td className="px-4 py-3 text-slate-600">{subjectMap[a.assignment_id] ?? `#${a.assignment_id}`}</td>
                <td className="px-6 py-3 text-right">
                  {a.is_present
                    ? <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Присутствовал</span>
                    : <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">Отсутствовал</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Вкладка тестов ---
function TestsTab({ sessions }: { sessions: TestSession[] }) {
  if (sessions.length === 0) return <Empty text="Тестов нет" />
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-6 py-3 text-slate-500 font-medium">Дата</th>
            <th className="text-left px-4 py-3 text-slate-500 font-medium">Статус</th>
            <th className="text-right px-4 py-3 text-slate-500 font-medium">Баллы</th>
            <th className="text-right px-6 py-3 text-slate-500 font-medium">Результат</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sessions.map(s => {
            const pct = s.score_max && s.score_max > 0 ? Math.round((s.score_total ?? 0) / s.score_max * 100) : null
            return (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 text-slate-500">{s.started_at.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    s.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    s.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {s.status === 'completed' ? 'Завершён' : s.status === 'in_progress' ? 'В процессе' : s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-500">
                  {s.score_total !== null && s.score_max !== null ? `${s.score_total} / ${s.score_max}` : '—'}
                </td>
                <td className="px-6 py-3 text-right">
                  {pct !== null ? (
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      pct >= 75 ? 'bg-emerald-100 text-emerald-700' :
                      pct >= 50 ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>{pct}%</span>
                  ) : <span className="text-slate-400">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// --- Вкладка рекомендаций ---
function AdaptiveTab({ rows, studentId }: { rows: AdaptiveRow[]; studentId: number }) {
  const [data, setData] = useState<{ subject: string; avg_grade: number; grades_count: number }[]>([])

  useEffect(() => {
    client.get(`/analytics/student-subjects/${studentId}`)
      .then(r => setData(r.data as { subject: string; avg_grade: number; grades_count: number }[]))
      .catch(() => {})
  }, [studentId])

  if (data.length === 0) return <Empty text="Данных по предметам нет" />
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-6 py-3 text-slate-500 font-medium">Предмет</th>
            <th className="text-right px-4 py-3 text-slate-500 font-medium">Оценок</th>
            <th className="text-right px-6 py-3 text-slate-500 font-medium">Средний балл</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map(r => (
            <tr key={r.subject} className="hover:bg-slate-50">
              <td className="px-6 py-3 text-slate-800 font-medium">{r.subject}</td>
              <td className="px-4 py-3 text-right text-slate-500">{r.grades_count}</td>
              <td className="px-6 py-3 text-right">
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  r.avg_grade >= 4.5 ? 'bg-emerald-100 text-emerald-700' :
                  r.avg_grade >= 3.5 ? 'bg-blue-100 text-blue-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {Number(r.avg_grade).toFixed(2)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

function StatCard({ label, value, color = 'text-slate-800' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
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
  return <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400 shadow-sm">{text}</div>
}
