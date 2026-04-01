import { useEffect, useState } from 'react'
import client from '../../api/client'

interface Department { id: number; name: string; code: string; description?: string }

export default function DepartmentsPage() {
  const [depts, setDepts] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get<Department[]>('/departments').then(r => setDepts(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">Кафедры</h1>
      <p className="text-slate-400 text-sm mb-6">Всего: {depts.length}</p>

      {depts.length === 0 ? <Empty text="Кафедр нет" /> : (
        <div className="space-y-3">
          {depts.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{d.name}</p>
                  {d.description && <p className="text-sm text-slate-400 mt-1">{d.description}</p>}
                </div>
                <span className="text-xs bg-blue-50 text-blue-600 font-mono px-2 py-1 rounded">{d.code}</span>
              </div>
            </div>
          ))}
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
