import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { getStudents, getTeachers, getGroups, getSubjects } from '../../api/resources'
import { getTopStudents } from '../../api/analytics'
import type { TopStudent } from '../../api/analytics'

interface Stats {
  students: number
  teachers: number
  groups: number
  subjects: number
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1']

type SortDir = 'desc' | 'asc'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [topStudents, setTopStudents] = useState<TopStudent[]>([])
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getStudents(),
      getTeachers(),
      getGroups(),
      getSubjects(),
      getTopStudents(undefined, 10),
    ]).then(([students, teachers, groups, subjects, top]) => {
      setStats({
        students: students.length,
        teachers: teachers.length,
        groups: groups.length,
        subjects: subjects.length,
      })
      setTopStudents(top)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  const statCards = [
    { label: 'Студентов', value: stats?.students ?? 0, color: 'bg-blue-500', icon: '🎓', to: '/students' },
    { label: 'Преподавателей', value: stats?.teachers ?? 0, color: 'bg-purple-500', icon: '👨‍🏫', to: '/teachers' },
    { label: 'Учебных групп', value: stats?.groups ?? 0, color: 'bg-emerald-500', icon: '👥', to: '/groups' },
    { label: 'Дисциплин', value: stats?.subjects ?? 0, color: 'bg-amber-500', icon: '📚', to: '/subjects' },
  ]

  const sorted = [...topStudents].sort((a, b) =>
    sortDir === 'desc'
      ? Number(b.avg_grade) - Number(a.avg_grade)
      : Number(a.avg_grade) - Number(b.avg_grade)
  )

  const chartData = sorted.map(s => ({
    name: s.name.split(' ').slice(0, 2).join(' '),
    avg: Number(s.avg_grade),
    group: s.group,
  }))

  return (
    <div className="p-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Главная</h1>
        <p className="text-slate-400 text-sm mt-1">Общая статистика системы</p>
      </div>

      {/* Счётчики — кликабельные */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map(card => (
          <button
            key={card.label}
            onClick={() => navigate(card.to)}
            className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-left
                       hover:shadow-md hover:border-slate-200 transition-all cursor-pointer"
          >
            <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center text-xl mb-3`}>
              {card.icon}
            </div>
            <p className="text-3xl font-bold text-slate-800">{card.value}</p>
            <p className="text-sm text-slate-500 mt-0.5">{card.label}</p>
          </button>
        ))}
      </div>

      {/* Топ студентов — график */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-slate-700">Рейтинг студентов по среднему баллу</h2>
            <SortButton dir={sortDir} onChange={setSortDir} />
          </div>
          <p className="text-xs text-slate-400 mb-5">Топ-{chartData.length} по всем дисциплинам</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 0, right: 16, left: -10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                formatter={(v: number) => [v.toFixed(2), 'Средний балл']}
                labelFormatter={(label, payload) => {
                  const group = payload?.[0]?.payload?.group
                  return `${label}${group ? ` (${group})` : ''}`
                }}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Топ студентов — таблица */}
      {sorted.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-700">Топ студентов</h2>
            <SortButton dir={sortDir} onChange={setSortDir} />
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium w-8">#</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">ФИО</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Группа</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Средний балл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map((s, i) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/students/${s.id}`)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-3 text-slate-400 font-medium">{i + 1}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.group}</td>
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
    </div>
  )
}

function SortButton({ dir, onChange }: { dir: SortDir; onChange: (d: SortDir) => void }) {
  return (
    <button
      onClick={() => onChange(dir === 'desc' ? 'asc' : 'desc')}
      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600
                 border border-slate-200 rounded-lg px-2.5 py-1 hover:border-blue-300 transition-colors cursor-pointer"
    >
      {dir === 'desc' ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          По убыванию
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          По возрастанию
        </>
      )}
    </button>
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
