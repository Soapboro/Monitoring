import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import {
  getGroupSummary, getGroupAttendanceBySubject, getTopStudents,
} from '../../api/analytics'
import type { GroupSummaryRow, AttendanceBySubjectRow, TopStudent } from '../../api/analytics'

type SortDir = 'desc' | 'asc'

export default function TeacherDashboard() {
  const navigate = useNavigate()
  const [teacherName, setTeacherName] = useState('')
  const [groupIds, setGroupIds] = useState<number[]>([])
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null)
  const [groupNames, setGroupNames] = useState<Record<number, string>>({})
  const [gradeSummary, setGradeSummary] = useState<GroupSummaryRow[]>([])
  const [attendance, setAttendance] = useState<AttendanceBySubjectRow[]>([])
  const [topStudents, setTopStudents] = useState<TopStudent[]>([])
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const [teacher, groups] = await Promise.all([
          getMyTeacherProfile(),
          fetch('/api/groups', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          }).then(r => r.json()),
        ])
        setTeacherName(`${teacher.last_name} ${teacher.first_name}`)

        const myAssignments = await getAssignments(teacher.id)
        const uniqueGroupIds = [...new Set(myAssignments.map(a => a.group_id))]
        setGroupIds(uniqueGroupIds)

        const nameMap: Record<number, string> = {}
        for (const g of groups) nameMap[g.id] = g.name
        setGroupNames(nameMap)

        if (uniqueGroupIds.length > 0) setSelectedGroup(uniqueGroupIds[0])
      } catch {
        // silent
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
      getGroupAttendanceBySubject(selectedGroup),
      getTopStudents(selectedGroup, 5),
    ]).then(([summary, att, top]) => {
      setGradeSummary(summary)
      setAttendance(att)
      setTopStudents(top)
    })
  }, [selectedGroup])

  if (loading) return <Spinner />

  const gradeChartData = gradeSummary.map(r => ({
    name: r.subject.length > 16 ? r.subject.slice(0, 14) + '…' : r.subject,
    fullName: r.subject,
    avg: Number(r.avg_grade),
  }))

  const attChartData = attendance.map(r => ({
    name: r.subject.length > 16 ? r.subject.slice(0, 14) + '…' : r.subject,
    fullName: r.subject,
    rate: r.rate_pct ?? 0,
  }))

  const avgAttendance = attendance.length > 0
    ? Math.round(attendance.reduce((s, r) => s + (r.rate_pct ?? 0), 0) / attendance.length)
    : null

  const avgGrade = gradeSummary.length > 0
    ? (gradeSummary.reduce((s, r) => s + Number(r.avg_grade), 0) / gradeSummary.length).toFixed(2)
    : null

  const sortedStudents = [...topStudents].sort((a, b) =>
    sortDir === 'desc'
      ? Number(b.avg_grade) - Number(a.avg_grade)
      : Number(a.avg_grade) - Number(b.avg_grade)
  )

  const statCards = [
    {
      label: 'Моих групп',
      value: groupIds.length,
      sub: null,
      to: '/my-groups',
    },
    {
      label: 'Средний балл по группе',
      value: avgGrade ?? '—',
      sub: groupNames[selectedGroup!] ?? '',
      to: '/grades',
    },
    {
      label: 'Средняя посещаемость',
      value: avgAttendance !== null ? `${avgAttendance}%` : '—',
      sub: groupNames[selectedGroup!] ?? '',
      to: '/attendance',
    },
  ]

  return (
    <div className="p-8 max-w-6xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Главная</h1>
          <p className="text-slate-400 text-sm mt-1">{teacherName}</p>
        </div>
        {groupIds.length > 1 && (
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

      {/* Счётчики — кликабельные */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map(card => (
          <button
            key={card.label}
            onClick={() => navigate(card.to)}
            className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-left
                       hover:shadow-md hover:border-slate-200 transition-all cursor-pointer"
          >
            <p className="text-sm text-slate-500 mb-1">{card.label}</p>
            <p className="text-3xl font-bold text-slate-800">{card.value}</p>
            {card.sub && <p className="text-xs text-slate-400 mt-0.5">{card.sub}</p>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {gradeChartData.length > 0 && (
          <div
            onClick={() => navigate('/grades')}
            className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm cursor-pointer hover:shadow-md hover:border-slate-200 transition-all"
          >
            <h2 className="text-base font-semibold text-slate-700 mb-1">Средний балл по дисциплинам</h2>
            <p className="text-xs text-slate-400 mb-4">{groupNames[selectedGroup!] ?? ''}</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={gradeChartData} margin={{ top: 0, right: 8, left: -16, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  formatter={(v: number) => [v.toFixed(2), 'Средний балл']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                  contentStyle={{ borderRadius: 8, fontSize: 11 }}
                />
                <Bar dataKey="avg" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {attChartData.length > 0 && (
          <div
            onClick={() => navigate('/attendance')}
            className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm cursor-pointer hover:shadow-md hover:border-slate-200 transition-all"
          >
            <h2 className="text-base font-semibold text-slate-700 mb-1">Посещаемость по дисциплинам</h2>
            <p className="text-xs text-slate-400 mb-4">{groupNames[selectedGroup!] ?? ''}</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={attChartData} margin={{ top: 0, right: 8, left: -16, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} unit="%" />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, 'Посещаемость']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                  contentStyle={{ borderRadius: 8, fontSize: 11 }}
                />
                <Bar dataKey="rate" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {sortedStudents.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-700">
              Студенты — {groupNames[selectedGroup!] ?? ''}
            </h2>
            <SortButton dir={sortDir} onChange={setSortDir} />
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
              {sortedStudents.map((s, i) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/students/${s.id}`)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
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

      {!selectedGroup && !loading && (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400 shadow-sm">
          Нет назначенных групп. Обратитесь к администратору.
        </div>
      )}
    </div>
  )
}

function SortButton({ dir, onChange }: { dir: SortDir; onChange: (d: SortDir) => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(dir === 'desc' ? 'asc' : 'desc') }}
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
