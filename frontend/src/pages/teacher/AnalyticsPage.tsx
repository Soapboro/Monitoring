import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import { getGroupSummary, getGroupAttendanceBySubject, getTopStudents } from '../../api/analytics'
import type { GroupSummaryRow, TopStudent } from '../../api/analytics'
import client from '../../api/client'

export default function AnalyticsPage() {
  const [groupIds, setGroupIds] = useState<number[]>([])
  const [groupNames, setGroupNames] = useState<Record<number, string>>({})
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null)
  const [gradeSummary, setGradeSummary] = useState<GroupSummaryRow[]>([])
  const [topStudents, setTopStudents] = useState<TopStudent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const teacher = await getMyTeacherProfile()
        const [assignments, groups] = await Promise.all([
          getAssignments(teacher.id),
          client.get<{ id: number; name: string }[]>('/groups').then(r => r.data),
        ])
        const ids = [...new Set(assignments.map(a => a.group_id))]
        setGroupIds(ids)
        const nameMap: Record<number, string> = {}
        for (const g of groups) nameMap[g.id] = g.name
        setGroupNames(nameMap)
        if (ids.length > 0) setSelectedGroup(ids[0])
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!selectedGroup) return
    Promise.all([
      getGroupSummary(selectedGroup),
      getTopStudents(selectedGroup, 10),
    ]).then(([summary, top]) => {
      setGradeSummary(summary)
      setTopStudents(top)
    })
  }, [selectedGroup])

  if (loading) return <Spinner />

  const chartData = gradeSummary.map(r => ({
    name: r.subject.length > 16 ? r.subject.slice(0, 14) + '…' : r.subject,
    fullName: r.subject,
    avg: Number(r.avg_grade),
    min: Number(r.min_grade),
    max: Number(r.max_grade),
    students: r.students_count,
  }))

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Аналитика</h1>
          <p className="text-slate-400 text-sm">Успеваемость и рейтинг по группам</p>
        </div>
        {groupIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Группа:</span>
            <select
              value={selectedGroup ?? ''}
              onChange={e => setSelectedGroup(Number(e.target.value))}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {groupIds.map(id => (
                <option key={id} value={id}>{groupNames[id] ?? `Группа ${id}`}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-700 mb-1">Средний балл по дисциплинам</h2>
          <p className="text-xs text-slate-400 mb-5">{groupNames[selectedGroup!] ?? ''}</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 0, right: 16, left: -10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                formatter={(v: number, key: string) => [
                  v.toFixed(2),
                  key === 'avg' ? 'Средний' : key === 'min' ? 'Мин' : 'Макс'
                ]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="avg" fill="#3b82f6" radius={[4, 4, 0, 0]} name="avg" />
              <Bar dataKey="min" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="min" />
              <Bar dataKey="max" fill="#10b981" radius={[4, 4, 0, 0]} name="max" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {topStudents.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-700">
              Рейтинг студентов — {groupNames[selectedGroup!] ?? ''}
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium w-8">#</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">ФИО</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Средний балл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {topStudents.map((s, i) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-400 font-medium">{i + 1}</td>
                  <td className="px-4 py-3 text-slate-800">{s.name}</td>
                  <td className="px-6 py-3 text-right">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      s.avg_grade >= 4.5 ? 'bg-emerald-100 text-emerald-700' :
                      s.avg_grade >= 3.5 ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {Number(s.avg_grade).toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!selectedGroup && (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">
          Нет назначенных групп
        </div>
      )}
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
