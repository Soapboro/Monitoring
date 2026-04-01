import { useEffect, useState } from 'react'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import client from '../../api/client'

interface AttendanceOut {
  id: number; student_id: number; assignment_id: number
  lesson_date: string; is_present: boolean; comment: string | null
}
interface StudentProfile { id: number; last_name: string; first_name: string; middle_name: string | null }

interface DateRow {
  date: string
  total: number
  present: number
  records: AttendanceOut[]
}

export default function AttendancePage() {
  const [dateRows, setDateRows] = useState<DateRow[]>([])
  const [studentMap, setStudentMap] = useState<Record<number, StudentProfile>>({})
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const teacher = await getMyTeacherProfile()
        const assignments = await getAssignments(teacher.id)

        // Все записи посещаемости
        const all: AttendanceOut[] = []
        for (const a of assignments) {
          const res = await client.get<AttendanceOut[]>('/attendance', { params: { assignment_id: a.id } })
          all.push(...res.data)
        }

        // Уникальные студенты
        const studentIds = [...new Set(all.map(r => r.student_id))]
        const sMap: Record<number, StudentProfile> = {}
        await Promise.all(studentIds.map(async sid => {
          try {
            const s = await client.get<StudentProfile>(`/students/${sid}`)
            sMap[sid] = s.data
          } catch { /* silent */ }
        }))
        setStudentMap(sMap)

        // Группируем по дате
        const byDate: Record<string, AttendanceOut[]> = {}
        for (const r of all) {
          const d = String(r.lesson_date).slice(0, 10)
          if (!byDate[d]) byDate[d] = []
          byDate[d].push(r)
        }
        const rows: DateRow[] = Object.entries(byDate)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, records]) => ({
            date,
            total: records.length,
            present: records.filter(r => r.is_present).length,
            records,
          }))
        setDateRows(rows)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  if (loading) return <Spinner />

  const totalPresent = dateRows.reduce((s, r) => s + r.present, 0)
  const totalAll = dateRows.reduce((s, r) => s + r.total, 0)
  const avgRate = totalAll > 0 ? Math.round(totalPresent / totalAll * 100) : null

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">Посещаемость</h1>
      <p className="text-slate-400 text-sm mb-6">Нажмите на дату для просмотра списка</p>

      {dateRows.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Занятий" value={dateRows.length} />
          <StatCard label="Всего отметок" value={totalAll} />
          <StatCard label="Средняя посещаемость" value={avgRate !== null ? `${avgRate}%` : '—'}
            color={avgRate !== null && avgRate >= 75 ? 'text-emerald-600' : 'text-amber-500'} />
        </div>
      )}

      {dateRows.length === 0 ? <Empty text="Записей нет" /> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Дата</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Всего</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Присутствовало</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {dateRows.map(row => {
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
                      <td className="px-6 py-3 text-slate-700 font-medium flex items-center gap-2">
                        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        {row.date}
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
                            {/* Присутствовавшие */}
                            <div>
                              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                                Присутствовали ({row.present})
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {row.records.filter(r => r.is_present).map(r => {
                                  const s = studentMap[r.student_id]
                                  return (
                                    <span key={r.id} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5">
                                      {s ? `${s.last_name} ${s.first_name}` : `#${r.student_id}`}
                                    </span>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Отсутствовавшие */}
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
                                        <span className="bg-red-50 text-red-600 border border-red-200 rounded-full px-2.5 py-0.5">
                                          {s ? `${s.last_name} ${s.first_name}` : `#${r.student_id}`}
                                        </span>
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
