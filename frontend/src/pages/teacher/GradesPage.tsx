import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import client from '../../api/client'
import type { GradeOut, StudentProfile, TeachingAssignment, Subject } from '../../api/resources'

interface EnrichedGrade extends GradeOut {
  studentName: string
  subjectName: string
  subjectId: number
  assignment: TeachingAssignment
}

export default function GradesPage() {
  const navigate = useNavigate()
  const [grades, setGrades] = useState<EnrichedGrade[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [gradeTypes, setGradeTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

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

        // Subject map
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

        // Assignment map
        const assignmentMap: Record<number, TeachingAssignment> = {}
        for (const a of assignments) assignmentMap[a.id] = a

        // All grades
        const rawGrades: GradeOut[] = []
        await Promise.all(
          assignments.map(a =>
            client.get<GradeOut[]>('/grades', { params: { assignment_id: a.id } }).then(r => {
              rawGrades.push(...r.data)
            })
          )
        )

        // Student map
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

  const toggle = (id: number) => setExpanded(prev => (prev === id ? null : id))

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

      {/* Count */}
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
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Дата</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Студент</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Предмет</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Тип</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Оценка</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(g => (
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
                    <tr key={`${g.id}-detail`} className="bg-blue-50/50">
                      <td colSpan={6} className="px-8 py-4">
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

function gradeTypeLabel(type: string) {
  const map: Record<string, string> = {
    exam: 'Экзамен',
    credit: 'Зачёт',
    current: 'Текущая',
    midterm: 'Промежуточная',
    final: 'Итоговая',
  }
  return map[type] ?? type
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
