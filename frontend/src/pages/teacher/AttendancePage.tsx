import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import client from '../../api/client'
import type { TeachingAssignment } from '../../api/resources'

interface AttendanceOut {
  id: number; student_id: number; assignment_id: number
  lesson_date: string; is_present: boolean; comment: string | null
}
interface StudentProfile { id: number; last_name: string; first_name: string; middle_name: string | null }
interface SubjectInfo { id: number; name: string }

interface DateRow {
  date: string
  total: number
  present: number
  records: AttendanceOut[]
  subjectNames: string[]
}

export default function AttendancePage() {
  const navigate = useNavigate()
  const [dateRows, setDateRows] = useState<DateRow[]>([])
  const [studentMap, setStudentMap] = useState<Record<number, StudentProfile>>({})
  const [subjects, setSubjects] = useState<SubjectInfo[]>([])
  const [assignmentSubjectMap, setAssignmentSubjectMap] = useState<Record<number, number>>({})
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const [rateFilter, setRateFilter] = useState<string>('all')

  useEffect(() => {
    async function init() {
      try {
        const teacher = await getMyTeacherProfile()
        const assignments: TeachingAssignment[] = await getAssignments(teacher.id)

        // Subject map
        const subjectIds = [...new Set(assignments.map(a => a.subject_id))]
        const subjectMap: Record<number, string> = {}
        const subjectList: SubjectInfo[] = []
        await Promise.all(subjectIds.map(async sid => {
          try {
            const r = await client.get<SubjectInfo>(`/subjects/${sid}`)
            subjectMap[sid] = r.data.name
            subjectList.push(r.data)
          } catch { /* silent */ }
        }))
        setSubjects(subjectList.sort((a, b) => a.name.localeCompare(b.name)))

        // assignment → subject_id map
        const aToSubject: Record<number, number> = {}
        for (const a of assignments) aToSubject[a.id] = a.subject_id
        setAssignmentSubjectMap(aToSubject)

        // All attendance records
        const all: AttendanceOut[] = []
        await Promise.all(assignments.map(async a => {
          try {
            const res = await client.get<AttendanceOut[]>('/attendance', { params: { assignment_id: a.id } })
            all.push(...res.data)
          } catch { /* silent */ }
        }))

        // Unique students
        const studentIds = [...new Set(all.map(r => r.student_id))]
        const sMap: Record<number, StudentProfile> = {}
        await Promise.all(studentIds.map(async sid => {
          try {
            const s = await client.get<StudentProfile>(`/students/${sid}`)
            sMap[sid] = s.data
          } catch { /* silent */ }
        }))
        setStudentMap(sMap)

        // Group by date
        const byDate: Record<string, AttendanceOut[]> = {}
        for (const r of all) {
          const d = String(r.lesson_date).slice(0, 10)
          if (!byDate[d]) byDate[d] = []
          byDate[d].push(r)
        }

        const rows: DateRow[] = Object.entries(byDate)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, records]) => {
            const uniqueSubjectIds = [...new Set(records.map(r => aToSubject[r.assignment_id]).filter(Boolean))]
            return {
              date,
              total: records.length,
              present: records.filter(r => r.is_present).length,
              records,
              subjectNames: uniqueSubjectIds.map(sid => subjectMap[sid]).filter(Boolean) as string[],
            }
          })
        setDateRows(rows)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const filtered = useMemo(() => {
    return dateRows.filter(row => {
      const rate = row.total > 0 ? Math.round(row.present / row.total * 100) : 0

      // Date search
      if (search && !row.date.includes(search)) return false

      // Subject filter — check if any record in this row belongs to the selected subject
      if (subjectFilter !== 'all') {
        const subjectId = parseInt(subjectFilter)
        const hasSubject = row.records.some(r => assignmentSubjectMap[r.assignment_id] === subjectId)
        if (!hasSubject) return false
      }

      // Rate filter
      if (rateFilter === 'high' && rate < 75) return false
      if (rateFilter === 'medium' && (rate < 50 || rate >= 75)) return false
      if (rateFilter === 'low' && rate >= 50) return false

      return true
    })
  }, [dateRows, search, subjectFilter, rateFilter, assignmentSubjectMap])

  if (loading) return <Spinner />

  const totalPresent = filtered.reduce((s, r) => s + r.present, 0)
  const totalAll = filtered.reduce((s, r) => s + r.total, 0)
  const avgRate = totalAll > 0 ? Math.round(totalPresent / totalAll * 100) : null

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">Посещаемость</h1>
      <p className="text-slate-400 text-sm mb-6">Нажмите на дату для просмотра списка</p>

      {/* Stats */}
      {dateRows.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Занятий" value={filtered.length} />
          <StatCard label="Всего отметок" value={totalAll} />
          <StatCard
            label="Средняя посещаемость"
            value={avgRate !== null ? `${avgRate}%` : '—'}
            color={avgRate !== null && avgRate >= 75 ? 'text-emerald-600' : 'text-amber-500'}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Поиск по дате (гггг-мм-дд)..."
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
          value={rateFilter}
          onChange={e => setRateFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="all">Любая посещаемость</option>
          <option value="high">Высокая (≥75%)</option>
          <option value="medium">Средняя (50–74%)</option>
          <option value="low">Низкая (&lt;50%)</option>
        </select>

        {(search || subjectFilter !== 'all' || rateFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setSubjectFilter('all'); setRateFilter('all') }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg bg-white transition-colors"
          >
            Сбросить
          </button>
        )}
      </div>

      {filtered.length === 0 ? <Empty text="Ничего не найдено" /> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Дата</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Предмет(ы)</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Всего</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Присутствовало</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const rate = Math.round(row.present / row.total * 100)
                const absent = row.records.filter(r => !r.is_present)
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
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {row.subjectNames.length > 0 ? row.subjectNames.join(', ') : '—'}
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
                        <td colSpan={5} className="bg-slate-50 px-6 py-4 border-t border-slate-100">
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

                            {absent.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                                  Отсутствовали ({absent.length})
                                </p>
                                <div className="space-y-1.5">
                                  {absent.map(r => {
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
