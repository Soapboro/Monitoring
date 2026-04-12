import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { getStudents, getTeachers, getGroups, getSubjects } from '../../api/resources'
import {
  getTopStudents, getRatingByGroups, getRatingBySubjects,
} from '../../api/analytics'
import type { TopStudent, GroupRatingRow, SubjectRatingRow } from '../../api/analytics'

interface Stats { students: number; teachers: number; groups: number; subjects: number }

type Mode = 'students' | 'groups' | 'subjects'
type SortDir = 'desc' | 'asc'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1']
const gradeColor = (avg: number) =>
  avg >= 4.5 ? 'bg-emerald-100 text-emerald-700' :
  avg >= 3.5 ? 'bg-blue-100 text-blue-700' :
  avg >= 2.5 ? 'bg-amber-100 text-amber-700' :
  'bg-red-100 text-red-700'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [students, setStudents] = useState<TopStudent[]>([])
  const [groups, setGroups] = useState<GroupRatingRow[]>([])
  const [subjects, setSubjects] = useState<SubjectRatingRow[]>([])
  const [mode, setMode] = useState<Mode>('students')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getStudents(), getTeachers(), getGroups(), getSubjects(),
      getTopStudents(), getRatingByGroups(), getRatingBySubjects(),
    ]).then(([sts, tch, grps, subjs, top, grpRating, subjRating]) => {
      setStats({ students: sts.length, teachers: tch.length, groups: grps.length, subjects: subjs.length })
      setStudents(top)
      setGroups(grpRating)
      setSubjects(subjRating)
    }).finally(() => setLoading(false))
  }, [])

  // Reset search on mode change
  const handleMode = (m: Mode) => { setMode(m); setSearch('') }

  const sortedStudents = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = q
      ? students.filter(s => s.name.toLowerCase().includes(q) || s.group.toLowerCase().includes(q))
      : students
    return [...filtered].sort((a, b) =>
      sortDir === 'desc' ? Number(b.avg_grade) - Number(a.avg_grade) : Number(a.avg_grade) - Number(b.avg_grade)
    )
  }, [students, sortDir, search])

  const sortedGroups = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = q ? groups.filter(g => g.group.toLowerCase().includes(q)) : groups
    return [...filtered].sort((a, b) =>
      sortDir === 'desc' ? Number(b.avg_grade) - Number(a.avg_grade) : Number(a.avg_grade) - Number(b.avg_grade)
    )
  }, [groups, sortDir, search])

  const sortedSubjects = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = q ? subjects.filter(s => s.subject.toLowerCase().includes(q)) : subjects
    return [...filtered].sort((a, b) =>
      sortDir === 'desc' ? Number(b.avg_grade) - Number(a.avg_grade) : Number(a.avg_grade) - Number(b.avg_grade)
    )
  }, [subjects, sortDir, search])

  if (loading) return <Spinner />

  const statCards = [
    { label: 'Студентов', value: stats?.students ?? 0, color: 'bg-blue-500', icon: '🎓', to: '/students' },
    { label: 'Преподавателей', value: stats?.teachers ?? 0, color: 'bg-purple-500', icon: '👨‍🏫', to: '/teachers' },
    { label: 'Учебных групп', value: stats?.groups ?? 0, color: 'bg-emerald-500', icon: '👥', to: '/groups' },
    { label: 'Дисциплин', value: stats?.subjects ?? 0, color: 'bg-amber-500', icon: '📚', to: '/subjects' },
  ]

  // Chart — top-15 for readability
  const chartItems =
    mode === 'students' ? sortedStudents.slice(0, 15).map(s => ({ name: s.name.split(' ').slice(0, 2).join(' '), avg: Number(s.avg_grade), sub: s.group })) :
    mode === 'groups'   ? sortedGroups.slice(0, 15).map(g => ({ name: g.group, avg: Number(g.avg_grade), sub: `${g.students_count} студ.` })) :
                          sortedSubjects.slice(0, 15).map(s => ({ name: s.subject.length > 20 ? s.subject.slice(0, 20) + '…' : s.subject, avg: Number(s.avg_grade), sub: `${s.students_count} студ.` }))

  return (
    <div className="p-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Главная</h1>
        <p className="text-slate-400 text-sm mt-1">Общая статистика системы</p>
      </div>

      {/* Счётчики */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map(card => (
          <button key={card.label} onClick={() => navigate(card.to)}
            className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-left hover:shadow-md hover:border-slate-200 transition-all cursor-pointer">
            <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center text-xl mb-3`}>
              {card.icon}
            </div>
            <p className="text-3xl font-bold text-slate-800">{card.value}</p>
            <p className="text-sm text-slate-500 mt-0.5">{card.label}</p>
          </button>
        ))}
      </div>

      {/* Рейтинг — переключатель */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Заголовок с режимами */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-slate-700">Рейтинг успеваемости</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {mode === 'students' && `${sortedStudents.length} студентов`}
                {mode === 'groups' && `${sortedGroups.length} групп`}
                {mode === 'subjects' && `${sortedSubjects.length} предметов`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Поиск */}
              <input
                type="text"
                placeholder={mode === 'students' ? 'Поиск студента...' : mode === 'groups' ? 'Поиск группы...' : 'Поиск предмета...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {/* Направление */}
              <button
                onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:border-blue-300 transition-colors cursor-pointer"
              >
                {sortDir === 'desc' ? (
                  <><ArrowDown /> По убыванию</>
                ) : (
                  <><ArrowUp /> По возрастанию</>
                )}
              </button>
              {/* Переключатель режима */}
              <div className="flex bg-slate-100 rounded-lg p-1">
                {([
                  { key: 'students' as Mode, label: 'Студенты' },
                  { key: 'groups' as Mode, label: 'Группы' },
                  { key: 'subjects' as Mode, label: 'Предметы' },
                ]).map(m => (
                  <button
                    key={m.key}
                    onClick={() => handleMode(m.key)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                      mode === m.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* График — топ-15 */}
        {chartItems.length > 0 && (
          <div className="px-6 pt-5 pb-2">
            <p className="text-xs text-slate-400 mb-3">Топ-{chartItems.length} (по среднему баллу)</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartItems} margin={{ top: 0, right: 16, left: -10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(v: number) => [v.toFixed(2), 'Средний балл']}
                  labelFormatter={(label, payload) => {
                    const sub = payload?.[0]?.payload?.sub
                    return `${label}${sub ? ` (${sub})` : ''}`
                  }}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                  {chartItems.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Таблица */}
        {mode === 'students' && (
          <StudentsTable rows={sortedStudents} navigate={navigate} />
        )}
        {mode === 'groups' && (
          <GroupsTable rows={sortedGroups} navigate={navigate} />
        )}
        {mode === 'subjects' && (
          <SubjectsTable rows={sortedSubjects} navigate={navigate} />
        )}
      </div>
    </div>
  )
}

function StudentsTable({ rows, navigate }: { rows: TopStudent[]; navigate: (p: string) => void }) {
  if (rows.length === 0) return <EmptyRow />
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50">
        <tr>
          <th className="text-left px-6 py-3 text-slate-500 font-medium w-10">#</th>
          <th className="text-left px-4 py-3 text-slate-500 font-medium">ФИО</th>
          <th className="text-left px-4 py-3 text-slate-500 font-medium">Группа</th>
          <th className="text-right px-6 py-3 text-slate-500 font-medium">Средний балл</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {rows.map((s, i) => (
          <tr key={s.id} onClick={() => navigate(`/students/${s.id}`)}
            className="hover:bg-slate-50 transition-colors cursor-pointer">
            <td className="px-6 py-2.5 text-slate-400 font-medium">{i + 1}</td>
            <td className="px-4 py-2.5 text-slate-800 font-medium">{s.name}</td>
            <td className="px-4 py-2.5 text-slate-500">{s.group}</td>
            <td className="px-6 py-2.5 text-right">
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${gradeColor(Number(s.avg_grade))}`}>
                {Number(s.avg_grade).toFixed(2)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function GroupsTable({ rows, navigate }: { rows: GroupRatingRow[]; navigate: (p: string) => void }) {
  if (rows.length === 0) return <EmptyRow />
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50">
        <tr>
          <th className="text-left px-6 py-3 text-slate-500 font-medium w-10">#</th>
          <th className="text-left px-4 py-3 text-slate-500 font-medium">Группа</th>
          <th className="text-right px-4 py-3 text-slate-500 font-medium">Студентов</th>
          <th className="text-right px-4 py-3 text-slate-500 font-medium">Оценок</th>
          <th className="text-right px-6 py-3 text-slate-500 font-medium">Средний балл</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {rows.map((g, i) => (
          <tr key={g.id} onClick={() => navigate(`/groups/${g.id}`)}
            className="hover:bg-slate-50 transition-colors cursor-pointer">
            <td className="px-6 py-2.5 text-slate-400 font-medium">{i + 1}</td>
            <td className="px-4 py-2.5 text-slate-800 font-medium">{g.group}</td>
            <td className="px-4 py-2.5 text-right text-slate-500">{g.students_count}</td>
            <td className="px-4 py-2.5 text-right text-slate-500">{g.grades_count}</td>
            <td className="px-6 py-2.5 text-right">
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${gradeColor(Number(g.avg_grade))}`}>
                {Number(g.avg_grade).toFixed(2)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SubjectsTable({ rows, navigate }: { rows: SubjectRatingRow[]; navigate: (p: string) => void }) {
  if (rows.length === 0) return <EmptyRow />
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50">
        <tr>
          <th className="text-left px-6 py-3 text-slate-500 font-medium w-10">#</th>
          <th className="text-left px-4 py-3 text-slate-500 font-medium">Предмет</th>
          <th className="text-right px-4 py-3 text-slate-500 font-medium">Студентов</th>
          <th className="text-right px-4 py-3 text-slate-500 font-medium">Оценок</th>
          <th className="text-right px-6 py-3 text-slate-500 font-medium">Средний балл</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {rows.map((s, i) => (
          <tr key={s.id} onClick={() => navigate(`/subjects/${s.id}`)}
            className="hover:bg-slate-50 transition-colors cursor-pointer">
            <td className="px-6 py-2.5 text-slate-400 font-medium">{i + 1}</td>
            <td className="px-4 py-2.5 text-slate-800 font-medium">{s.subject}</td>
            <td className="px-4 py-2.5 text-right text-slate-500">{s.students_count}</td>
            <td className="px-4 py-2.5 text-right text-slate-500">{s.grades_count}</td>
            <td className="px-6 py-2.5 text-right">
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${gradeColor(Number(s.avg_grade))}`}>
                {Number(s.avg_grade).toFixed(2)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ArrowDown() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}
function ArrowUp() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  )
}
function EmptyRow() {
  return (
    <div className="px-6 py-10 text-center text-slate-400 text-sm">Нет данных</div>
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
