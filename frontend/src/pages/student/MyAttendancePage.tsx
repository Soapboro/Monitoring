import { useEffect, useState } from 'react'
import { getMyAttendance } from '../../api/resources'
import type { AttendanceRecord } from '../../api/resources'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'

export default function MyAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyAttendance().then(setRecords).finally(() => setLoading(false))
  }, [])

  const filtered = records.filter(r =>
    String(r.lesson_date).slice(0, 10).includes(search) ||
    (r.is_present ? 'присутствовал' : 'отсутствовал').includes(search.toLowerCase())
  )

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, (r, key) => {
    if (key === 'date') return String(r.lesson_date).slice(0, 10)
    if (key === 'status') return r.is_present ? 1 : 0
    return ''
  })

  if (loading) return <Spinner />

  const present = records.filter(r => r.is_present).length
  const rate = records.length > 0 ? Math.round(present / records.length * 100) : null

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-slate-800">Посещаемость</h1>
        <input type="text" placeholder="Поиск по дате или статусу..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <p className="text-slate-400 text-sm mb-6">История посещений занятий · Всего: {records.length}</p>

      {records.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Всего занятий</p>
            <p className="text-2xl font-bold text-slate-800">{records.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Присутствовал</p>
            <p className="text-2xl font-bold text-emerald-600">{present}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Процент посещаемости</p>
            <p className={`text-2xl font-bold ${rate !== null && rate >= 75 ? 'text-emerald-600' : 'text-amber-500'}`}>
              {rate !== null ? `${rate}%` : '—'}
            </p>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <Empty text={records.length === 0 ? 'Записей о посещаемости нет' : 'Ничего не найдено'} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <SortableHeader label="Дата" sortKey="date" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-6" />
                <SortableHeader label="Статус" sortKey="status" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" className="px-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-600">{String(r.lesson_date).slice(0, 10)}</td>
                  <td className="px-6 py-3 text-right">
                    {r.is_present
                      ? <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Присутствовал</span>
                      : <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">Отсутствовал</span>
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
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">
      {text}
    </div>
  )
}
