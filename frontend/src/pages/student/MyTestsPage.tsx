import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { getMySessions } from '../../api/resources'
import type { TestSession } from '../../api/resources'
import { getSubjects } from '../../api/resources'
import type { Subject } from '../../api/resources'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AvailableTest {
  test_id: number
  title: string
  description: string | null
  subject_id: number
  time_limit_minutes: number | null
  attempts_allowed: number
  attempts_used: number
  passing_score_pct: number
  available_from: string | null
  available_to: string | null
  status: 'available' | 'in_progress' | 'passed' | 'exhausted' | 'expired'
  session_id: number | null
  best_pct: number | null
}

const AVAIL_STATUS = {
  available:   { label: 'Доступен',         cls: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'В процессе',       cls: 'bg-amber-100 text-amber-700' },
  passed:      { label: 'Сдан',             cls: 'bg-emerald-100 text-emerald-700' },
  exhausted:   { label: 'Попытки исчерпаны', cls: 'bg-slate-100 text-slate-500' },
  expired:     { label: 'Истёк срок',        cls: 'bg-red-100 text-red-500' },
}

const SESSION_STATUS = {
  completed:   { label: 'Завершён',   cls: 'bg-emerald-100 text-emerald-700' },
  in_progress: { label: 'В процессе', cls: 'bg-amber-100 text-amber-700' },
  timed_out:   { label: 'Время вышло', cls: 'bg-red-100 text-red-500' },
  abandoned:   { label: 'Прерван',    cls: 'bg-slate-100 text-slate-500' },
}

// ─── Available tests tab ──────────────────────────────────────────────────────

function AvailableTab({ subjects }: { subjects: Subject[] }) {
  const navigate = useNavigate()
  const [tests, setTests] = useState<AvailableTest[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<number | null>(null)

  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s.name]))

  useEffect(() => {
    client.get<AvailableTest[]>('/tests/my-available').then(r => setTests(r.data))
      .finally(() => setLoading(false))
  }, [])

  async function startOrContinue(t: AvailableTest) {
    if (t.status === 'in_progress' && t.session_id) {
      navigate(`/my-tests/session/${t.session_id}`)
      return
    }
    setStarting(t.test_id)
    try {
      const { data } = await client.post<{ id: number }>(`/sessions/start/${t.test_id}`)
      navigate(`/my-tests/session/${data.id}`)
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка запуска теста')
    } finally { setStarting(null) }
  }

  if (loading) return <Spinner />

  if (tests.length === 0) return (
    <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">
      Тестов пока нет
    </div>
  )

  return (
    <div className="grid gap-4">
      {tests.map(t => {
        const st = AVAIL_STATUS[t.status]
        const canStart = t.status === 'available' || t.status === 'in_progress'
        return (
          <div key={t.test_id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-slate-800">{t.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                </div>
                {t.description && (
                  <p className="text-sm text-slate-500 mb-2 line-clamp-2">{t.description}</p>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                  <span>{subjectMap[t.subject_id] ?? `Предмет ${t.subject_id}`}</span>
                  {t.time_limit_minutes && <span>⏱ {t.time_limit_minutes} мин</span>}
                  <span>Попытки: {t.attempts_used}/{t.attempts_allowed}</span>
                  <span>Порог: {t.passing_score_pct}%</span>
                  {t.available_to && (
                    <span>до {new Date(t.available_to).toLocaleDateString('ru')}</span>
                  )}
                  {t.best_pct !== null && (
                    <span className="text-emerald-600 font-medium">Лучший: {t.best_pct}%</span>
                  )}
                </div>
              </div>
              {canStart && (
                <button
                  onClick={() => startOrContinue(t)}
                  disabled={starting === t.test_id}
                  className={`shrink-0 px-4 py-2 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 ${
                    t.status === 'in_progress'
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}>
                  {starting === t.test_id ? 'Загрузка...' :
                    t.status === 'in_progress' ? 'Продолжить' : 'Начать'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── History tab ──────────────────────────────────────────────────────────────

function HistoryTab() {
  const [sessions, setSessions] = useState<TestSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMySessions().then(setSessions).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (sessions.length === 0) return (
    <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">
      Истории нет
    </div>
  )

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-6 py-3 text-slate-500 font-medium">Дата</th>
            <th className="text-left px-4 py-3 text-slate-500 font-medium">Тест</th>
            <th className="text-center px-4 py-3 text-slate-500 font-medium">Статус</th>
            <th className="text-right px-4 py-3 text-slate-500 font-medium">Баллы</th>
            <th className="text-right px-6 py-3 text-slate-500 font-medium">Результат</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sessions.map(s => {
            const pct = s.score_max && s.score_max > 0
              ? Math.round((s.score_total ?? 0) / s.score_max * 100)
              : null
            const st = SESSION_STATUS[s.status as keyof typeof SESSION_STATUS]
              ?? { label: s.status, cls: 'bg-slate-100 text-slate-500' }
            return (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 text-slate-500">
                  {new Date(s.started_at).toLocaleDateString('ru')}
                </td>
                <td className="px-4 py-3 text-slate-700">Тест #{s.test_id}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                    {st.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-500">
                  {s.score_total !== null && s.score_max !== null
                    ? `${s.score_total} / ${s.score_max}`
                    : '—'}
                </td>
                <td className="px-6 py-3 text-right">
                  {pct !== null ? (
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      s.passed === true ? 'bg-emerald-100 text-emerald-700' :
                      s.passed === false ? 'bg-red-100 text-red-600' :
                      'bg-slate-100 text-slate-500'
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
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MyTestsPage() {
  const [tab, setTab] = useState<'available' | 'history'>('available')
  const [subjects, setSubjects] = useState<Subject[]>([])

  useEffect(() => {
    getSubjects().then(setSubjects).catch(() => {})
  }, [])

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800 mb-1">Мои тесты</h1>
        <p className="text-slate-400 text-sm">Доступные тесты и история прохождений</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {([['available', 'Доступные'], ['history', 'История']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'available' && <AvailableTab subjects={subjects} />}
      {tab === 'history' && <HistoryTab />}
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center gap-3 text-slate-400 py-8">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      Загрузка...
    </div>
  )
}
