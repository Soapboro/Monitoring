import { useEffect, useState } from 'react'
import { getSubjects } from '../../api/resources'

interface Subject { id: number; name: string; code?: string | null; hours_total?: number }

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSubjects().then(setSubjects).finally(() => setLoading(false))
  }, [])

  const filtered = subjects.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Дисциплины</h1>
          <p className="text-slate-400 text-sm">Всего: {subjects.length}</p>
        </div>
        <input
          type="text"
          placeholder="Поиск..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {filtered.length === 0 ? <Empty text="Ничего не найдено" /> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Название</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Код</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Часов</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-800 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{s.code ?? '—'}</td>
                  <td className="px-6 py-3 text-right text-slate-500">{s.hours_total ?? '—'}</td>
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
