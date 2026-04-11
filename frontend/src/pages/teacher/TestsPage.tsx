import { useEffect, useState } from 'react'
import client from '../../api/client'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'

interface TestOut {
  id: number
  title: string
  subject_id: number
  topic_id: number | null
  time_limit_min: number | null
  pass_score_pct: number | null
  is_active: boolean
  created_at: string
}

export default function TestsPage() {
  const [tests, setTests] = useState<TestOut[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get<TestOut[]>('/tests').then(r => setTests(r.data)).finally(() => setLoading(false))
  }, [])

  const filtered = tests.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, (t, key) => {
    if (key === 'title') return t.title
    if (key === 'time') return t.time_limit_min ?? -1
    if (key === 'pass_score') return t.pass_score_pct ?? -1
    if (key === 'status') return t.is_active
    return ''
  })

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Тесты</h1>
          <p className="text-slate-400 text-sm">Список всех тестов · Всего: {tests.length}</p>
        </div>
        <input type="text" placeholder="Поиск по названию..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {sorted.length === 0 ? <Empty text="Ничего не найдено" /> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <SortableHeader label="Название" sortKey="title" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-6" />
                <SortableHeader label="Время (мин)" sortKey="time" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                <SortableHeader label="Порог сдачи" sortKey="pass_score" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                <SortableHeader label="Статус" sortKey="status" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" className="px-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-800 font-medium">{t.title}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{t.time_limit_min ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{t.pass_score_pct !== null ? `${t.pass_score_pct}%` : '—'}</td>
                  <td className="px-6 py-3 text-right">
                    {t.is_active
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
