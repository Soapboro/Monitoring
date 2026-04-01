import { useEffect, useState } from 'react'
import client from '../../api/client'

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get<TestOut[]>('/tests').then(r => setTests(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">Тесты</h1>
      <p className="text-slate-400 text-sm mb-6">Список всех тестов в системе</p>

      {tests.length === 0 ? <Empty text="Тестов пока нет" /> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Название</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Время (мин)</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Порог сдачи</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tests.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-800 font-medium">{t.title}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{t.time_limit_min ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {t.pass_score_pct !== null ? `${t.pass_score_pct}%` : '—'}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {t.is_active
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
