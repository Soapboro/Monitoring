import { useEffect, useState } from 'react'
import client from '../../api/client'

interface AdaptiveRow {
  topic_id: number
  topic: string
  subject: string
  mastery_level: number
  recommended_difficulty: number
  updated_at: string
}

export default function MyAdaptivePage() {
  const [rows, setRows] = useState<AdaptiveRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get<AdaptiveRow[]>('/students/me/adaptive')
      .then(r => setRows(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">Рекомендации</h1>
      <p className="text-slate-400 text-sm mb-6">Адаптивные рекомендации по темам на основе ваших результатов</p>

      {rows.length === 0 ? (
        <Empty text="Рекомендаций пока нет — пройдите несколько тестов" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Тема</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Предмет</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Освоение</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Рек. сложность</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(r => (
                <tr key={r.topic_id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-800 font-medium">{r.topic}</td>
                  <td className="px-4 py-3 text-slate-500">{r.subject}</td>
                  <td className="px-4 py-3 text-right">
                    <MasteryBar value={r.mastery_level} />
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      r.recommended_difficulty <= 2 ? 'bg-emerald-100 text-emerald-700' :
                      r.recommended_difficulty <= 3 ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {r.recommended_difficulty <= 2 ? 'Лёгкая' :
                       r.recommended_difficulty <= 3 ? 'Средняя' : 'Сложная'}
                    </span>
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

function MasteryBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="w-20 bg-slate-100 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-slate-600 w-8 text-right">{pct}%</span>
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
