import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import client from '../../api/client'
import type { GradeOut, StudentProfile, TeachingAssignment, Subject } from '../../api/resources'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'

interface EnrichedGrade extends GradeOut {
  studentName: string
  subjectName: string
  subjectId: number
  assignment: TeachingAssignment
}

interface EditState {
  grade_type: string
  value: string
  passed: string   // 'true' | 'false' | 'null'
  comment: string
  date_recorded: string
}

const GRADE_TYPES = [
  { value: 'current',    label: 'Текущая' },
  { value: 'thematic',   label: 'Тематическая' },
  { value: 'midterm',    label: 'Промежуточная' },
  { value: 'final',      label: 'Итоговая' },
  { value: 'attendance', label: 'Посещаемость' },
  { value: 'test',       label: 'Тестирование' },
]

function gradeTypeLabel(type: string) {
  return GRADE_TYPES.find(t => t.value === type)?.label ?? type
}

function toEditState(g: EnrichedGrade): EditState {
  return {
    grade_type: g.grade_type,
    value: g.value !== null ? String(g.value) : '',
    passed: g.passed === true ? 'true' : g.passed === false ? 'false' : 'null',
    comment: g.comment ?? '',
    date_recorded: g.date_recorded.slice(0, 10),
  }
}

export default function GradesPage() {
  const navigate = useNavigate()
  const [grades, setGrades] = useState<EnrichedGrade[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [gradeTypes, setGradeTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [valueFilter, setValueFilter] = useState<string>('all')

  useEffect(() => {
    async function init() {
      try {
        const teacher = await getMyTeacherProfile()
        const assignments: TeachingAssignment[] = await getAssignments(teacher.id)

        const subjectIds = [...new Set(assignments.map(a => a.subject_id))]
        const subjectMap: Record<number, string> = {}
        const subjectList: Subject[] = []
        await Promise.all(
          subjectIds.map(sid =>
            client.get<Subject>(`/subjects/${sid}`).then(r => {
              subjectMap[sid] = r.data.name
              subjectList.push(r.data)
            })
          )
        )
        setSubjects(subjectList.sort((a, b) => a.name.localeCompare(b.name)))

        const assignmentMap: Record<number, TeachingAssignment> = {}
        for (const a of assignments) assignmentMap[a.id] = a

        const rawGrades: GradeOut[] = []
        await Promise.all(
          assignments.map(a =>
            client.get<GradeOut[]>('/grades', { params: { assignment_id: a.id } }).then(r => {
              rawGrades.push(...r.data)
            })
          )
        )

        const studentIds = [...new Set(rawGrades.map(g => g.student_id))]
        const studentMap: Record<number, string> = {}
        await Promise.all(
          studentIds.map(sid =>
            client.get<StudentProfile>(`/students/${sid}`).then(r => {
              const s = r.data
              studentMap[sid] = `${s.last_name} ${s.first_name}${s.middle_name ? ' ' + s.middle_name : ''}`
            }).catch(() => { studentMap[sid] = `Студент #${sid}` })
          )
        )

        const enriched: EnrichedGrade[] = rawGrades.map(g => {
          const a = assignmentMap[g.assignment_id]
          return {
            ...g,
            studentName: studentMap[g.student_id] ?? `Студент #${g.student_id}`,
            subjectName: subjectMap[a?.subject_id] ?? `Предмет #${g.assignment_id}`,
            subjectId: a?.subject_id ?? 0,
            assignment: a,
          }
        })
        enriched.sort((a, b) => b.date_recorded.localeCompare(a.date_recorded))

        setGrades(enriched)
        setGradeTypes([...new Set(enriched.map(g => g.grade_type))])
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return grades.filter(g => {
      if (q && !g.studentName.toLowerCase().includes(q) && !g.subjectName.toLowerCase().includes(q)) return false
      if (subjectFilter !== 'all' && String(g.subjectId) !== subjectFilter) return false
      if (typeFilter !== 'all' && g.grade_type !== typeFilter) return false
      if (valueFilter !== 'all') {
        if (valueFilter === 'pass' && g.passed !== true) return false
        if (valueFilter === 'fail' && g.passed !== false) return false
        if (!isNaN(Number(valueFilter)) && g.value !== Number(valueFilter)) return false
      }
      return true
    })
  }, [grades, search, subjectFilter, typeFilter, valueFilter])

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, (g, key) => {
    if (key === 'date') return g.date_recorded
    if (key === 'student') return g.studentName
    if (key === 'subject') return g.subjectName
    if (key === 'type') return gradeTypeLabel(g.grade_type)
    if (key === 'value') return g.value ?? (g.passed === true ? 1 : g.passed === false ? 0 : -1)
    return ''
  })

  const toggle = (id: number) => {
    if (expanded === id) {
      setExpanded(null)
      setEditing(null)
      setEditState(null)
    } else {
      setExpanded(id)
      setEditing(null)
      setEditState(null)
    }
  }

  function startEdit(g: EnrichedGrade, e: React.MouseEvent) {
    e.stopPropagation()
    setEditing(g.id)
    setEditState(toEditState(g))
  }

  function cancelEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setEditing(null)
    setEditState(null)
  }

  async function saveEdit(g: EnrichedGrade, e: React.MouseEvent) {
    e.stopPropagation()
    if (!editState) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        grade_type: editState.grade_type,
        comment: editState.comment || null,
        date_recorded: editState.date_recorded,
      }
      if (editState.value !== '') payload.value = Number(editState.value)
      if (editState.passed !== 'null') payload.passed = editState.passed === 'true'

      const { data } = await client.patch<GradeOut>(`/grades/${g.id}`, payload)

      setGrades(prev => prev.map(gr =>
        gr.id === g.id
          ? { ...gr, ...data }
          : gr
      ))
      setEditing(null)
      setEditState(null)
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const hasFilters = search || subjectFilter !== 'all' || typeFilter !== 'all' || valueFilter !== 'all'

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">Оценки</h1>
      <p className="text-slate-400 text-sm mb-6">Все выставленные оценки по вашим дисциплинам</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Поиск по студенту или предмету..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 text-slate-700 placeholder-slate-400"
          />
        </div>

        {subjects.length > 1 && (
          <select
            value={subjectFilter}
            onChange={e => setSubjectFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="all">Все предметы</option>
            {subjects.map(s => (
              <option key={s.id} value={String(s.id)}>{s.name}</option>
            ))}
          </select>
        )}

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="all">Все типы</option>
          {gradeTypes.map(t => (
            <option key={t} value={t}>{gradeTypeLabel(t)}</option>
          ))}
        </select>

        <select
          value={valueFilter}
          onChange={e => setValueFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="all">Любая оценка</option>
          <option value="5">5</option>
          <option value="4">4</option>
          <option value="3">3</option>
          <option value="2">2</option>
          <option value="pass">Зачёт</option>
          <option value="fail">Незачёт</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setSubjectFilter('all'); setTypeFilter('all'); setValueFilter('all') }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg bg-white transition-colors"
          >
            Сбросить
          </button>
        )}
      </div>

      {grades.length > 0 && (
        <p className="text-xs text-slate-400 mb-3">
          Показано: {filtered.length} из {grades.length}
        </p>
      )}

      {filtered.length === 0 ? (
        <Empty text={grades.length === 0 ? 'Оценок пока нет' : 'Ничего не найдено'} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <SortableHeader label="Дата" sortKey="date" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-6" />
                <SortableHeader label="Студент" sortKey="student" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Предмет" sortKey="subject" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Тип" sortKey="type" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Оценка" sortKey="value" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" className="px-6" />
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map(g => (
                <>
                  <tr
                    key={g.id}
                    onClick={() => toggle(g.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3 text-slate-500 whitespace-nowrap">{g.date_recorded.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-slate-800 font-medium">{g.studentName}</td>
                    <td className="px-4 py-3 text-slate-600">{g.subjectName}</td>
                    <td className="px-4 py-3 text-slate-500">{gradeTypeLabel(g.grade_type)}</td>
                    <td className="px-6 py-3 text-right">
                      {g.value !== null ? (
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          g.value >= 4 ? 'bg-emerald-100 text-emerald-700' :
                          g.value >= 3 ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-700'
                        }`}>{g.value}</span>
                      ) : g.passed !== null ? (
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          g.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>{g.passed ? 'Зачёт' : 'Незачёт'}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="pr-4 text-slate-400 text-right">
                      <svg className={`w-4 h-4 inline transition-transform ${expanded === g.id ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                  </tr>

                  {expanded === g.id && (
                    <tr key={`${g.id}-detail`} className="bg-slate-50/70">
                      <td colSpan={6} className="px-8 py-5">
                        {editing === g.id && editState ? (
                          /* ── Режим редактирования ── */
                          <div onClick={e => e.stopPropagation()}>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Редактирование оценки</p>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                              {/* Тип */}
                              <label className="flex flex-col gap-1">
                                <span className="text-slate-500 text-xs">Тип оценки</span>
                                <select
                                  value={editState.grade_type}
                                  onChange={e => setEditState(s => s && ({ ...s, grade_type: e.target.value }))}
                                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                >
                                  {GRADE_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                  ))}
                                </select>
                              </label>

                              {/* Дата */}
                              <label className="flex flex-col gap-1">
                                <span className="text-slate-500 text-xs">Дата</span>
                                <input
                                  type="date"
                                  value={editState.date_recorded}
                                  onChange={e => setEditState(s => s && ({ ...s, date_recorded: e.target.value }))}
                                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                />
                              </label>

                              {/* Оценка */}
                              <label className="flex flex-col gap-1">
                                <span className="text-slate-500 text-xs">Балл (1–5, оставьте пустым для зачёт/незачёт)</span>
                                <input
                                  type="number"
                                  min={1} max={5} step={1}
                                  value={editState.value}
                                  onChange={e => setEditState(s => s && ({ ...s, value: e.target.value }))}
                                  placeholder="—"
                                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white w-24"
                                />
                              </label>

                              {/* Зачёт/незачёт */}
                              <label className="flex flex-col gap-1">
                                <span className="text-slate-500 text-xs">Зачёт / незачёт</span>
                                <select
                                  value={editState.passed}
                                  onChange={e => setEditState(s => s && ({ ...s, passed: e.target.value }))}
                                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                >
                                  <option value="null">Не задан</option>
                                  <option value="true">Зачёт</option>
                                  <option value="false">Незачёт</option>
                                </select>
                              </label>

                              {/* Комментарий */}
                              <label className="flex flex-col gap-1 col-span-2">
                                <span className="text-slate-500 text-xs">Комментарий</span>
                                <input
                                  type="text"
                                  value={editState.comment}
                                  onChange={e => setEditState(s => s && ({ ...s, comment: e.target.value }))}
                                  placeholder="Необязательно"
                                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                />
                              </label>
                            </div>

                            <div className="flex gap-2 mt-4">
                              <button
                                onClick={e => saveEdit(g, e)}
                                disabled={saving}
                                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                              >
                                {saving ? 'Сохранение...' : 'Сохранить'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-4 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* ── Режим просмотра ── */
                          <div>
                            <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500">Студент: </span>
                                <button
                                  onClick={e => { e.stopPropagation(); navigate(`/students/${g.student_id}`) }}
                                  className="text-blue-600 font-medium hover:underline cursor-pointer"
                                >
                                  {g.studentName}
                                </button>
                              </div>
                              <DetailRow label="Предмет" value={g.subjectName} />
                              <DetailRow label="Тип оценки" value={gradeTypeLabel(g.grade_type)} />
                              <DetailRow
                                label="Оценка / результат"
                                value={
                                  g.value !== null ? String(g.value)
                                  : g.passed !== null ? (g.passed ? 'Зачёт' : 'Незачёт')
                                  : '—'
                                }
                              />
                              {g.assignment && (
                                <>
                                  <DetailRow label="Учебный год" value={g.assignment.acad_year} />
                                  <DetailRow label="Семестр" value={String(g.assignment.semester)} />
                                </>
                              )}
                              {g.session_id !== null && (
                                <DetailRow label="Сессия #" value={String(g.session_id)} />
                              )}
                              {g.comment && (
                                <div className="col-span-2">
                                  <span className="text-slate-500">Комментарий: </span>
                                  <span className="text-slate-700">{g.comment}</span>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={e => startEdit(g, e)}
                              className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                            >
                              Изменить
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500">{label}: </span>
      <span className="text-slate-700 font-medium">{value}</span>
    </div>
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
  return <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">{text}</div>
}
