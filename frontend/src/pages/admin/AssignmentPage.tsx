import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import type { TeachingAssignment, Subject, StudentProfile, GradeOut, AttendanceRecord, TeacherProfile } from '../../api/resources'
import { updateAssignment } from '../../api/resources'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'

const CONTROL_FORMS = ['Экзамен', 'Зачёт', 'Дифференцированный зачёт', 'Контрольная работа', 'Курсовая работа', 'Реферат']

type Tab = 'grades' | 'attendance'

interface DateRow {
  date: string
  total: number
  present: number
  records: AttendanceRecord[]
}

const GRADE_TYPE_LABELS: Record<string, string> = {
  current: 'Текущая', midterm: 'Промежуточная', final: 'Итоговая',
  test: 'Тест', exam: 'Экзамен', credit: 'Зачёт',
}

export default function AssignmentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [assignment, setAssignment] = useState<TeachingAssignment | null>(null)
  const [subject, setSubject] = useState<Subject | null>(null)
  const [groupName, setGroupName] = useState('')
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null)
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [grades, setGrades] = useState<GradeOut[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [tab, setTab] = useState<Tab>('grades')
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [expandedStudent, setExpandedStudent] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [editControlForm, setEditControlForm] = useState(false)
  const [controlFormValue, setControlFormValue] = useState('')
  const [savingCF, setSavingCF] = useState(false)

  useEffect(() => {
    if (!id) return
    async function init() {
      try {
        const a = await client.get<TeachingAssignment>(`/teaching-assignments/${id}`).then(r => r.data)
        setAssignment(a)
        setControlFormValue(a.control_form ?? '')

        const [subj, grp, t, studs, gr, att] = await Promise.all([
          client.get<Subject>(`/subjects/${a.subject_id}`).then(r => r.data).catch(() => null),
          client.get<{ name: string }>(`/groups/${a.group_id}`).then(r => r.data).catch(() => null),
          client.get<TeacherProfile>(`/teachers/${a.teacher_id}`).then(r => r.data).catch(() => null),
          client.get<StudentProfile[]>('/students', { params: { group_id: a.group_id } }).then(r => r.data).catch(() => []),
          client.get<GradeOut[]>('/grades', { params: { assignment_id: id } }).then(r => r.data).catch(() => []),
          client.get<AttendanceRecord[]>('/attendance', { params: { assignment_id: id } }).then(r => r.data).catch(() => []),
        ])

        setSubject(subj)
        setGroupName(grp?.name ?? '')
        setTeacher(t)
        setStudents(studs)
        setGrades(gr)
        setAttendance(att)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [id])

  const studentMap: Record<number, StudentProfile> = {}
  for (const s of students) studentMap[s.id] = s

  // Attendance: group by date
  const byDate: Record<string, AttendanceRecord[]> = {}
  for (const r of attendance) {
    const d = String(r.lesson_date).slice(0, 10)
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(r)
  }
  const dateRows: DateRow[] = Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, records]) => ({
      date, total: records.length,
      present: records.filter(r => r.is_present).length,
      records,
    }))

  // Grades: group by student_id
  const gradesByStudent: Record<number, GradeOut[]> = {}
  for (const g of grades) {
    if (!gradesByStudent[g.student_id]) gradesByStudent[g.student_id] = []
    gradesByStudent[g.student_id].push(g)
  }

  const studentGradeRows = Object.entries(gradesByStudent).map(([sid, sGrades]) => ({
    sid: Number(sid), sGrades,
  }))

  const { sorted: sortedStudents, sortKey: gradesSortKey, sortDir: gradesSortDir, toggleSort: gradesToggleSort } = useSort(studentGradeRows, (row, key) => {
    const s = studentMap[row.sid]
    if (key === 'student') return s ? `${s.last_name} ${s.first_name}` : `Студент #${row.sid}`
    if (key === 'count') return row.sGrades.length
    if (key === 'avg') {
      const nums = row.sGrades.filter(g => g.value !== null)
      return nums.length > 0 ? nums.reduce((s, g) => s + (g.value ?? 0), 0) / nums.length : -1
    }
    return ''
  })

  const { sorted: sortedDates, sortKey: attSortKey, sortDir: attSortDir, toggleSort: attToggleSort } = useSort(dateRows, (row, key) => {
    if (key === 'date') return row.date
    if (key === 'total') return row.total
    if (key === 'present') return row.present
    if (key === 'rate') return row.total > 0 ? Math.round(row.present / row.total * 100) : -1
    return ''
  })

  if (loading) return <Spinner />
  if (!assignment) return <div className="p-8 text-slate-400">Назначение не найдено</div>

  const teacherName = teacher ? `${teacher.last_name} ${teacher.first_name}` : ''

  const totalPresent = attendance.filter(r => r.is_present).length
  const attendanceRate = attendance.length > 0 ? Math.round(totalPresent / attendance.length * 100) : null
  const numericGrades = grades.filter(g => g.value !== null)
  const avgGrade = numericGrades.length > 0
    ? (numericGrades.reduce((s, g) => s + (g.value ?? 0), 0) / numericGrades.length).toFixed(2)
    : null

  return (
    <div className="p-8 max-w-5xl">
      {/* Хлебные крошки */}
      <nav className="flex items-center flex-wrap gap-1.5 text-sm text-slate-400 mb-6">
        <button onClick={() => navigate('/teachers')} className="hover:text-blue-600 cursor-pointer transition-colors">Преподаватели</button>
        <Chevron />
        {teacher && (
          <>
            <button onClick={() => navigate(`/teachers/${assignment.teacher_id}`)} className="hover:text-blue-600 cursor-pointer transition-colors">
              {teacherName}
            </button>
            <Chevron />
          </>
        )}
        <button onClick={() => navigate(`/groups/${assignment.group_id}`)} className="hover:text-blue-600 cursor-pointer transition-colors">
          {groupName}
        </button>
        <Chevron />
        <span className="text-slate-600 font-medium">{subject?.name ?? `Предмет #${assignment.subject_id}`}</span>
      </nav>

      {/* Шапка */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">{subject?.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-slate-500">
              <button onClick={() => navigate(`/groups/${assignment.group_id}`)} className="text-blue-600 hover:underline cursor-pointer">
                {groupName}
              </button>
              {teacher && (
                <>
                  <span>·</span>
                  <button onClick={() => navigate(`/teachers/${assignment.teacher_id}`)} className="text-blue-600 hover:underline cursor-pointer">
                    {teacherName}
                  </button>
                </>
              )}
              <span>· {assignment.acad_year}, сем. {assignment.semester}</span>
              {editControlForm ? (
                <span className="flex items-center gap-1.5">
                  ·
                  <select
                    value={controlFormValue}
                    onChange={e => setControlFormValue(e.target.value)}
                    className="border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— не указана —</option>
                    {CONTROL_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <button
                    onClick={async () => {
                      setSavingCF(true)
                      const updated = await updateAssignment(assignment.id, { control_form: controlFormValue || null })
                      setAssignment(updated)
                      setEditControlForm(false)
                      setSavingCF(false)
                    }}
                    disabled={savingCF}
                    className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                  >
                    Сохранить
                  </button>
                  <button onClick={() => setEditControlForm(false)} className="text-xs text-slate-400 hover:text-slate-600">
                    Отмена
                  </button>
                </span>
              ) : (
                <span
                  onClick={() => setEditControlForm(true)}
                  className="cursor-pointer hover:text-blue-600 transition-colors"
                  title="Изменить форму контроля"
                >
                  · {assignment.control_form ?? <span className="text-slate-300">форма контроля не указана</span>}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
          <Stat label="Студентов" value={students.length} />
          <Stat label="Оценок" value={grades.length} />
          <Stat label="Средний балл" value={avgGrade ?? '—'} />
          <Stat label="Посещаемость" value={attendanceRate !== null ? `${attendanceRate}%` : '—'} />
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit">
        {([
          { key: 'grades' as Tab, label: 'Оценки', count: grades.length },
          { key: 'attendance' as Tab, label: 'Посещаемость', count: attendance.length },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`ml-1.5 text-xs ${tab === t.key ? 'text-blue-600' : 'text-slate-400'}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Оценки */}
      {tab === 'grades' && (
        <>
          {grades.length === 0 ? <Empty text="Оценок нет" /> : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <SortableHeader label="Студент" sortKey="student" currentKey={gradesSortKey} dir={gradesSortDir} onSort={gradesToggleSort} className="px-6" />
                    <SortableHeader label="Оценок" sortKey="count" currentKey={gradesSortKey} dir={gradesSortDir} onSort={gradesToggleSort} align="right" />
                    <SortableHeader label="Ср. балл" sortKey="avg" currentKey={gradesSortKey} dir={gradesSortDir} onSort={gradesToggleSort} align="right" />
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map(({ sid, sGrades }) => {
                    const student = studentMap[sid]
                    const nums = sGrades.filter(g => g.value !== null)
                    const avg = nums.length > 0
                      ? (nums.reduce((s, g) => s + (g.value ?? 0), 0) / nums.length).toFixed(2)
                      : null
                    const isOpen = expandedStudent === sid
                    return (
                      <>
                        <tr
                          key={sid}
                          onClick={() => setExpandedStudent(isOpen ? null : sid)}
                          className="border-t border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-3">
                            <button
                              onClick={e => { e.stopPropagation(); navigate(`/students/${sid}`) }}
                              className="text-slate-800 font-medium hover:text-blue-600 hover:underline cursor-pointer text-left"
                            >
                              {student ? `${student.last_name} ${student.first_name}${student.middle_name ? ' ' + student.middle_name : ''}` : `Студент #${sid}`}
                            </button>
                          </td>

                          <td className="px-4 py-3 text-right text-slate-500">{sGrades.length}</td>
                          <td className="px-4 py-3 text-right">
                            {avg !== null ? (
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                Number(avg) >= 4 ? 'bg-emerald-100 text-emerald-700' :
                                Number(avg) >= 3 ? 'bg-blue-100 text-blue-700' :
                                'bg-red-100 text-red-700'
                              }`}>{avg}</span>
                            ) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="pr-4 text-slate-400 text-right">
                            <svg className={`w-4 h-4 inline transition-transform ${isOpen ? 'rotate-90' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`${sid}-detail`} className="bg-blue-50/40">
                            <td colSpan={4} className="px-6 py-3">
                              <div className="space-y-1">
                                {[...sGrades].sort((a, b) => b.date_recorded.localeCompare(a.date_recorded)).map(g => (
                                  <div key={g.id} className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">
                                      {String(g.date_recorded).slice(0, 10)} · {GRADE_TYPE_LABELS[g.grade_type] ?? g.grade_type}
                                      {g.comment ? ` · ${g.comment}` : ''}
                                    </span>
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
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Посещаемость */}
      {tab === 'attendance' && (
        <>
          {attendance.length === 0 ? <Empty text="Записей нет" /> : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <SortableHeader label="Дата" sortKey="date" currentKey={attSortKey} dir={attSortDir} onSort={attToggleSort} className="px-6" />
                    <SortableHeader label="Всего" sortKey="total" currentKey={attSortKey} dir={attSortDir} onSort={attToggleSort} align="right" />
                    <SortableHeader label="Присутствовало" sortKey="present" currentKey={attSortKey} dir={attSortDir} onSort={attToggleSort} align="right" />
                    <SortableHeader label="%" sortKey="rate" currentKey={attSortKey} dir={attSortDir} onSort={attToggleSort} align="right" className="px-6" />
                  </tr>
                </thead>
                <tbody>
                  {sortedDates.map(row => {
                    const rate = Math.round(row.present / row.total * 100)
                    const isOpen = expandedDate === row.date
                    return (
                      <>
                        <tr
                          key={row.date}
                          onClick={() => setExpandedDate(isOpen ? null : row.date)}
                          className="border-t border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-3 text-slate-700 font-medium">
                            <span className="flex items-center gap-2">
                              <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              {row.date}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500">{row.total}</td>
                          <td className="px-4 py-3 text-right text-emerald-600 font-medium">{row.present}</td>
                          <td className="px-6 py-3 text-right">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              rate >= 75 ? 'bg-emerald-100 text-emerald-700' :
                              rate >= 50 ? 'bg-amber-100 text-amber-600' :
                              'bg-red-100 text-red-600'
                            }`}>{rate}%</span>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`${row.date}-detail`}>
                            <td colSpan={4} className="bg-slate-50 px-6 py-4 border-t border-slate-100">
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                                    Присутствовали ({row.present})
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {row.records.filter(r => r.is_present).map(r => {
                                      const s = studentMap[r.student_id]
                                      return (
                                        <button
                                          key={r.id}
                                          onClick={e => { e.stopPropagation(); navigate(`/students/${r.student_id}`) }}
                                          className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5 hover:bg-emerald-100 cursor-pointer transition-colors"
                                        >
                                          {s ? `${s.last_name} ${s.first_name}` : `#${r.student_id}`}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                                {row.records.filter(r => !r.is_present).length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                                      Отсутствовали ({row.records.filter(r => !r.is_present).length})
                                    </p>
                                    <div className="space-y-1.5">
                                      {row.records.filter(r => !r.is_present).map(r => {
                                        const s = studentMap[r.student_id]
                                        return (
                                          <div key={r.id} className="flex items-center gap-3 text-xs">
                                            <button
                                              onClick={e => { e.stopPropagation(); navigate(`/students/${r.student_id}`) }}
                                              className="bg-red-50 text-red-600 border border-red-200 rounded-full px-2.5 py-0.5 hover:bg-red-100 cursor-pointer transition-colors"
                                            >
                                              {s ? `${s.last_name} ${s.first_name}` : `#${r.student_id}`}
                                            </button>
                                            {r.comment && (
                                              <span className="text-slate-400 italic">Причина: {r.comment}</span>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
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
  return <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400 shadow-sm">{text}</div>
}
