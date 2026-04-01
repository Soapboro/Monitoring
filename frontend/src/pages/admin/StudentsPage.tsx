import { useEffect, useState } from 'react'
import { getStudents } from '../../api/resources'
import type { StudentProfile } from '../../api/resources'

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStudents().then(setStudents).finally(() => setLoading(false))
  }, [])

  const filtered = students.filter(s => {
    const full = `${s.last_name} ${s.first_name} ${s.middle_name ?? ''} ${s.student_num ?? ''}`.toLowerCase()
    return full.includes(search.toLowerCase())
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

      {filtered.length === 0 ? <Empty text="Ничего не найдено" /> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">ФИО</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">№ студ.</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Группа ID</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-800 font-medium">
                    {s.last_name} {s.first_name} {s.middle_name ?? ''}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{s.student_num ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">#{s.group_id}</td>
                  <td className="px-6 py-3 text-right">
                    {s.is_active
                      ? <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Активен</span>
                      : <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Неактивен</span>
                    }
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
