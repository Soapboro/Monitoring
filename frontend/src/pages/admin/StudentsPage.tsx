import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStudents, getGroups } from '../../api/resources'
import type { StudentProfile } from '../../api/resources'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'

export default function StudentsPage() {
  const navigate = useNavigate()
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [groupNames, setGroupNames] = useState<Record<number, string>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getStudents(), getGroups()]).then(([studs, groups]) => {
      setStudents(studs)
      const map: Record<number, string> = {}
      for (const g of groups) map[g.id] = g.name
      setGroupNames(map)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = students.filter(s => {
    const full = `${s.last_name} ${s.first_name} ${s.middle_name ?? ''} ${s.student_num ?? ''}`.toLowerCase()
    return full.includes(search.toLowerCase())
  })

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, (s, key) => {
    if (key === 'name') return `${s.last_name} ${s.first_name}`
    if (key === 'student_num') return s.student_num ?? ''
    if (key === 'group') return groupNames[s.group_id] ?? ''
    if (key === 'status') return s.is_active
    return ''
  })

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Студенты</h1>
          <p className="text-slate-400 text-sm">Всего: {students.length}</p>
        </div>
        <input
          type="text"
          placeholder="Поиск по ФИО или номеру..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {sorted.length === 0 ? <Empty text="Ничего не найдено" /> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <SortableHeader label="ФИО" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-6" />
                <SortableHeader label="№ студ." sortKey="student_num" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Группа" sortKey="group" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Статус" sortKey="status" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" className="px-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map(s => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/students/${s.id}`)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-3 text-slate-800 font-medium flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-blue-600">{s.last_name[0]}</span>
                    </div>
                    {s.last_name} {s.first_name} {s.middle_name ?? ''}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{s.student_num ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    <button onClick={e => { e.stopPropagation(); navigate(`/groups/${s.group_id}`) }}
                      className="text-blue-600 hover:underline cursor-pointer">
                      {groupNames[s.group_id] ?? `#${s.group_id}`}
                    </button>
                  </td>
                  <td className="px-6 py-3 text-right">
                    {s.is_active
                      ? <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Активен</span>
                      : <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Неактивен</span>}
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

function Spinner() {
  return <div className="p-8 flex items-center gap-3 text-slate-400"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />Загрузка...</div>
}
function Empty({ text }: { text: string }) {
  return <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">{text}</div>
}
