import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTeachers } from '../../api/resources'
import type { TeacherProfile } from '../../api/resources'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'

export default function TeachersPage() {
  const navigate = useNavigate()
  const [teachers, setTeachers] = useState<TeacherProfile[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTeachers().then(setTeachers).finally(() => setLoading(false))
  }, [])

  const filtered = teachers.filter(t =>
    `${t.last_name} ${t.first_name} ${t.middle_name ?? ''} ${t.position ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, (t, key) => {
    if (key === 'name') return `${t.last_name} ${t.first_name}`
    if (key === 'position') return t.position ?? ''
    if (key === 'phone') return t.phone ?? ''
    return ''
  })

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Преподаватели</h1>
          <p className="text-slate-400 text-sm">Всего: {teachers.length}</p>
        </div>
        <input type="text" placeholder="Поиск по ФИО или должности..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {sorted.length === 0 ? <Empty text="Ничего не найдено" /> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <SortableHeader label="ФИО" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-6" />
                <SortableHeader label="Должность" sortKey="position" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Телефон" sortKey="phone" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map(t => (
                <tr key={t.id} onClick={() => navigate(`/teachers/${t.id}`)} className="hover:bg-blue-50 cursor-pointer transition-colors">
                  <td className="px-6 py-3 text-slate-800 font-medium flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-purple-600">{t.last_name[0]}</span>
                    </div>
                    {t.last_name} {t.first_name} {t.middle_name ?? ''}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{t.position ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{t.phone ?? '—'}</td>
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
