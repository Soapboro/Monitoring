import { useEffect, useState } from 'react'
import { getMyGrades } from '../../api/resources'
import type { GradeOut } from '../../api/resources'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'

const GRADE_TYPE_LABELS: Record<string, string> = {
  current: 'Текущая', midterm: 'Промежуточная', final: 'Итоговая', test: 'Тест',
}

export default function MyGradesPage() {
  const [grades, setGrades] = useState<GradeOut[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyGrades().then(setGrades).finally(() => setLoading(false))
  }, [])

  const filtered = grades.filter(g =>
    `${g.date_recorded} ${GRADE_TYPE_LABELS[g.grade_type] ?? g.grade_type}`.toLowerCase().includes(search.toLowerCase())
  )

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, (g, key) => {
    if (key === 'date') return g.date_recorded
    if (key === 'type') return GRADE_TYPE_LABELS[g.grade_type] ?? g.grade_type
    if (key === 'value') return g.value ?? -1
    if (key === 'passed') return g.passed === true ? 1 : g.passed === false ? 0 : -1
    return ''
  })

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Мои оценки</h1>
          <p className="text-slate-400 text-sm">Всего: {grades.length}</p>
        </div>
        <input type="text" placeholder="Поиск по дате или типу..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {sorted.length === 0 ? <Empty text="Ничего не найдено" /> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <SortableHeader label="Дата" sortKey="date" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-6" />
                <SortableHeader label="Тип" sortKey="type" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Оценка" sortKey="value" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                <SortableHeader label="Зачёт" sortKey="passed" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" className="px-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map(g => (
                <tr key={g.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-500">{String(g.date_recorded).slice(0, 10)}</td>
                  <td className="px-4 py-3 text-slate-600">{GRADE_TYPE_LABELS[g.grade_type] ?? g.grade_type}</td>
                  <td className="px-4 py-3 text-right">
                    {g.value !== null ? (
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${g.value >= 4 ? 'bg-emerald-100 text-emerald-700' : g.value >= 3 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{g.value}</span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {g.passed === true && <span className="text-emerald-600 text-xs font-medium">Сдано</span>}
                    {g.passed === false && <span className="text-red-500 text-xs font-medium">Не сдано</span>}
                    {g.passed === null && <span className="text-slate-400 text-xs">—</span>}
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
