import { useEffect, useState } from 'react'
import { getMySessions } from '../../api/resources'
import type { TestSession } from '../../api/resources'

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Завершён', cls: 'bg-emerald-100 text-emerald-700' },
  in_progress: { label: 'В процессе', cls: 'bg-blue-100 text-blue-700' },
  timed_out: { label: 'Время вышло', cls: 'bg-amber-100 text-amber-700' },
}

export default function MyTestsPage() {
  const [sessions, setSessions] = useState<TestSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMySessions().then(setSessions).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">Мои тесты</h1>
      <p className="text-slate-400 text-sm mb-6">История прохождения тестов</p>

      {sessions.length === 0 ? (
        <Empty text="Тестов пока нет" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Дата</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Статус</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Баллы</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Результат</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sessions.map(s => {
                const pct = s.score_max && s.score_max > 0
                  ? Math.round((s.score_total ?? 0) / s.score_max * 100)
                  : null
                const st = STATUS_LABELS[s.status] ?? { label: s.status, cls: 'bg-slate-100 text-slate-600' }
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-500">{s.started_at.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {s.score_total !== null && s.score_max !== null
                        ? `${s.score_total} / ${s.score_max}`
                        : '—'}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {pct !== null ? (
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          pct >= 75 ? 'bg-emerald-100 text-emerald-700' :
                          pct >= 50 ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {pct}%
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                )
              })}
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
