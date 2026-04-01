import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGroups } from '../../api/resources'

interface Group { id: number; name: string; year_start?: number; is_active?: boolean }

export default function GroupsPage() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getGroups().then(setGroups).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">Учебные группы</h1>
      <p className="text-slate-400 text-sm mb-6">Всего: {groups.length} · Нажмите на группу для просмотра списка</p>

      {groups.length === 0 ? <Empty text="Групп нет" /> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Название</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Год начала</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {groups.map(g => (
                <tr
                  key={g.id}
                  onClick={() => navigate(`/groups/${g.id}`)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-3 text-slate-800 font-medium flex items-center gap-2">
                    {g.name}
                    <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{g.year_start ?? '—'}</td>
                  <td className="px-6 py-3 text-right">
                    {g.is_active !== false
                      ? <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Активна</span>
                      : <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Неактивна</span>
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
