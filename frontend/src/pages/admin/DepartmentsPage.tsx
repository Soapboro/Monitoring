import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import type { Subject } from '../../api/resources'

interface Department { id: number; name: string; code: string | null; description: string | null }
interface Group { id: number; name: string; department_id: number | null; is_active: boolean }

interface DeptRow extends Department {
  subjectCount: number
  groupCount: number
}

export default function DepartmentsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<DeptRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const [depts, subjects, groups] = await Promise.all([
        client.get<Department[]>('/departments').then(r => r.data),
        client.get<Subject[]>('/subjects').then(r => r.data),
        client.get<Group[]>('/groups').then(r => r.data),
      ])

      const subjectCount: Record<number, number> = {}
      for (const s of subjects) if (s.department_id) subjectCount[s.department_id] = (subjectCount[s.department_id] ?? 0) + 1

      const groupCount: Record<number, number> = {}
      for (const g of groups) if (g.department_id) groupCount[g.department_id] = (groupCount[g.department_id] ?? 0) + 1

      setRows(depts.map(d => ({
        ...d,
        subjectCount: subjectCount[d.id] ?? 0,
        groupCount: groupCount[d.id] ?? 0,
      })))
    }
    init().finally(() => setLoading(false))
  }, [])

  const filtered = rows.filter(d =>
    `${d.name} ${d.code ?? ''} ${d.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Кафедры</h1>
          <p className="text-slate-400 text-sm">Всего: {rows.length}</p>
        </div>
        <input
          type="text"
          placeholder="Поиск по названию или коду..."
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
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Кафедра</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Код</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Дисциплин</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Групп</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(d => (
                <tr
                  key={d.id}
                  onClick={() => navigate(`/departments/${d.id}`)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-3">
                    <p className="font-medium text-slate-800">{d.name}</p>
                    {d.description && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{d.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {d.code
                      ? <span className="text-xs bg-blue-50 text-blue-600 font-mono px-2 py-0.5 rounded">{d.code}</span>
                      : <span className="text-slate-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      d.subjectCount > 0 ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'
                    }`}>{d.subjectCount || '—'}</span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      d.groupCount > 0 ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'
                    }`}>{d.groupCount || '—'}</span>
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
