import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import { getGroupSummary, getGroupAttendanceBySubject, getTopStudents } from '../../api/analytics'
import type { GroupSummaryRow, TopStudent } from '../../api/analytics'
import client from '../../api/client'

export default function AnalyticsPage() {
  const navigate = useNavigate()
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
      getTopStudents(selectedGroup),
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
    testsTotal: r.tests_total,
    testsPassed: r.tests_passed,
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
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload
                  if (!p) return ''
                  const tests = p.testsTotal > 0
                    ? ` · тесты: ${p.testsPassed}/${p.testsTotal}`
                    : ''
                  return `${p.fullName}${tests}`
                }}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="avg" fill="#3b82f6" radius={[4, 4, 0, 0]} name="avg" />
              <Bar dataKey="min" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="min" />
              <Bar dataKey="max" fill="#10b981" radius={[4, 4, 0, 0]} name="max" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {gradeSummary.some(r => r.tests_total > 0) && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-700">Тесты по дисциплинам</h2>
            <p className="text-xs text-slate-400 mt-0.5">{groupNames[selectedGroup!] ?? ''}</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Дисциплина</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Сдали / Выдано</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Прогресс</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {gradeSummary.filter(r => r.tests_total > 0).map(r => {
                const pct = r.tests_total > 0 ? Math.round(r.tests_passed / r.tests_total * 100) : 0
                return (
                  <tr key={r.subject} className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-800">{r.subject}</td>
                    <td className="px-6 py-3 text-right">
                      <span className={`font-semibold ${r.tests_passed >= r.tests_total ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {r.tests_passed}
                      </span>
                      <span className="text-slate-400"> / {r.tests_total}</span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-400' : pct >= 50 ? 'bg-blue-400' : 'bg-amber-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {topStudents.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-700">
              Рейтинг студентов — {groupNames[selectedGroup!] ?? ''}
            </h2>
            <span className="text-xs text-slate-400">{topStudents.length} студентов</span>
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
                <tr
                  key={s.id}
                  onClick={() => navigate(`/my-students/${s.id}`)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-3 font-medium" style={{
                    color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#94a3b8'
                  }}>
                    {i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-800 font-medium">{s.name}</span>
                    <span className="text-xs text-blue-500 ml-2 opacity-0 group-hover:opacity-100">→</span>
                  </td>
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
