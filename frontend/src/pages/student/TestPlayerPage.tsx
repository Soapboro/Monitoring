import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client from '../../api/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlayerQuestion {
  id: number
  question_type: string
  difficulty: string
  body: string
  image_url: string | null
  score_max: number
  options: {
    choices?: { id: string; text: string; image_url: string | null }[]
    left?: { id: string; text: string; image_url: string | null }[]
    right?: { id: string; text: string; image_url: string | null }[]
  }
}

interface Session {
  id: number; test_id: number; status: string
  score_total: number | null; score_max: number | null; passed: boolean | null
  time_limit_minutes?: number | null
}

type AnswerMap = Record<number, any> // question_id → answer_data

// ─── Timer ───────────────────────────────────────────────────────────────────

function useTimer(limitMinutes: number | null | undefined, onExpire: () => void) {
  const [left, setLeft] = useState<number | null>(null)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!limitMinutes) return
    setLeft(limitMinutes * 60)
    ref.current = setInterval(() => {
      setLeft(s => {
        if (s === null) return null
        if (s <= 1) { onExpire(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [limitMinutes])

  return left
}

function TimerDisplay({ seconds }: { seconds: number | null }) {
  if (seconds === null) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  const warn = seconds < 120
  return (
    <div className={`flex items-center gap-1.5 text-sm font-mono font-semibold px-3 py-1.5 rounded-lg ${
      warn ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-600'
    }`}>
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </div>
  )
}

// ─── Answer editors ───────────────────────────────────────────────────────────

function SingleChoice({ question, answer, onChange }: {
  question: PlayerQuestion; answer: any; onChange: (a: any) => void
}) {
  const choices = question.options.choices ?? []
  const selected = answer?.selected ?? null
  return (
    <div className="space-y-3">
      {choices.map(ch => (
        <label key={ch.id}
          className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
            selected === ch.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}>
          <input type="radio" name={`q${question.id}`} value={ch.id}
            checked={selected === ch.id} onChange={() => onChange({ selected: ch.id })}
            className="mt-0.5 accent-blue-600 shrink-0" />
          <div className="flex-1">
            {ch.image_url && <img src={ch.image_url} alt="" className="h-24 rounded mb-2 object-contain" />}
            <span className="text-sm text-slate-800">{ch.text}</span>
          </div>
        </label>
      ))}
    </div>
  )
}

function MultipleChoice({ question, answer, onChange }: {
  question: PlayerQuestion; answer: any; onChange: (a: any) => void
}) {
  const choices = question.options.choices ?? []
  const selected: string[] = answer?.selected ?? []
  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]
    onChange({ selected: next })
  }
  return (
    <div className="space-y-3">
      {choices.map(ch => (
        <label key={ch.id}
          className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
            selected.includes(ch.id) ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}>
          <input type="checkbox" value={ch.id}
            checked={selected.includes(ch.id)} onChange={() => toggle(ch.id)}
            className="mt-0.5 accent-blue-600 shrink-0" />
          <div className="flex-1">
            {ch.image_url && <img src={ch.image_url} alt="" className="h-24 rounded mb-2 object-contain" />}
            <span className="text-sm text-slate-800">{ch.text}</span>
          </div>
        </label>
      ))}
    </div>
  )
}

function TextInput({ answer, onChange }: { answer: any; onChange: (a: any) => void }) {
  return (
    <input
      type="text"
      value={answer?.text ?? ''}
      onChange={e => onChange({ text: e.target.value })}
      placeholder="Введите ответ..."
      className="w-full text-sm border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
    />
  )
}

function MatchingInput({ question, answer, onChange }: {
  question: PlayerQuestion; answer: any; onChange: (a: any) => void
}) {
  const left = question.options.left ?? []
  const right = question.options.right ?? []
  const pairs: Record<string, string> = answer?.pairs ?? {}

  // Shuffle right items for display (use state so it's stable)
  const [shuffledRight] = useState(() => [...right].sort(() => Math.random() - 0.5))

  function setPair(leftId: string, rightId: string) {
    onChange({ pairs: { ...pairs, [leftId]: rightId } })
  }

  return (
    <div className="space-y-3">
      {left.map(l => (
        <div key={l.id} className="flex items-center gap-4 p-4 bg-white border-2 border-slate-200 rounded-xl">
          <div className="flex-1 min-w-0">
            {l.image_url && <img src={l.image_url} alt="" className="h-20 rounded mb-2 object-contain" />}
            <p className="text-sm text-slate-800">{l.text}</p>
          </div>
          <svg className="w-5 h-5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <select
            value={pairs[l.id] ?? ''}
            onChange={e => setPair(l.id, e.target.value)}
            className={`flex-1 text-sm border-2 rounded-xl px-3 py-2.5 focus:outline-none transition-colors ${
              pairs[l.id] ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'
            }`}
          >
            <option value="">Выберите...</option>
            {shuffledRight.map(r => (
              <option key={r.id} value={r.id}>
                {r.text || `Элемент ${r.id}`}
              </option>
            ))}
          </select>
        </div>
      ))}
      {/* Right images preview if any */}
      {shuffledRight.some(r => r.image_url) && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {shuffledRight.map(r => r.image_url && (
            <div key={r.id} className="text-center">
              <img src={r.image_url} alt="" className="h-20 w-full rounded-lg object-contain border border-slate-200" />
              <p className="text-xs text-slate-500 mt-1">{r.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Results screen ───────────────────────────────────────────────────────────

function ResultsScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const pct = session.score_max
    ? Math.round((session.score_total ?? 0) / session.score_max * 100)
    : 0
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
          session.passed ? 'bg-emerald-100' : 'bg-red-100'
        }`}>
          <span className="text-3xl">{session.passed ? '✓' : '✗'}</span>
        </div>
        <h2 className={`text-2xl font-bold mb-1 ${session.passed ? 'text-emerald-600' : 'text-red-600'}`}>
          {session.passed ? 'Тест сдан!' : 'Тест не сдан'}
        </h2>
        <p className="text-slate-500 text-sm mb-6">
          {session.score_total?.toFixed(1)} из {session.score_max?.toFixed(1)} баллов
        </p>
        <div className="text-5xl font-bold mb-2 text-slate-800">{pct}%</div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-6">
          <div className={`h-full rounded-full transition-all ${session.passed ? 'bg-emerald-400' : 'bg-red-400'}`}
            style={{ width: `${pct}%` }} />
        </div>
        <button onClick={onBack}
          className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
          К списку тестов
        </button>
      </div>
    </div>
  )
}

// ─── Main player ──────────────────────────────────────────────────────────────

export default function TestPlayerPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const sid = Number(sessionId)

  const [session, setSession] = useState<Session | null>(null)
  const [questions, setQuestions] = useState<PlayerQuestion[]>([])
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [finished, setFinished] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const savingRef = useRef(false)

  useEffect(() => {
    Promise.all([
      client.get<Session>(`/sessions/${sid}`).then(r => r.data),
      client.get<PlayerQuestion[]>(`/sessions/${sid}/questions`).then(r => r.data),
    ]).then(([s, qs]) => {
      setSession(s)
      setQuestions(qs)
      if (s.status !== 'in_progress') setFinished(true)
    }).finally(() => setLoading(false))
  }, [sid])

  const timeLeft = useTimer(
    finished ? null : session?.time_limit_minutes,
    () => { if (!finished) handleFinish(true) }
  )

  const q = questions[current]
  const answered = Object.keys(answers).length

  async function saveCurrentAnswer() {
    if (!q || savingRef.current) return
    const data = answers[q.id]
    if (!data) return
    savingRef.current = true
    try {
      await client.post(`/sessions/${sid}/answer`, {
        question_id: q.id,
        answer_data: data,
      })
    } finally { savingRef.current = false }
  }

  async function goTo(idx: number) {
    await saveCurrentAnswer()
    setCurrent(idx)
  }

  async function handleFinish(auto = false) {
    if (!auto && !confirmFinish) { setConfirmFinish(true); return }
    await saveCurrentAnswer()
    setSubmitting(true)
    try {
      const { data } = await client.post<Session>(`/sessions/${sid}/finish`)
      setSession(data)
      setFinished(true)
      setConfirmFinish(false)
    } finally { setSubmitting(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex items-center gap-3 text-slate-400">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Загрузка теста...
      </div>
    </div>
  )

  if (finished && session) return <ResultsScreen session={session} onBack={() => navigate('/my-tests')} />

  if (!q) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
      Вопросов нет
    </div>
  )

  const isAnswered = (qid: number) => {
    const a = answers[qid]
    if (!a) return false
    const qt = questions.find(x => x.id === qid)?.question_type
    if (qt === 'single_choice') return !!a.selected
    if (qt === 'multiple_choice') return (a.selected?.length ?? 0) > 0
    if (qt === 'text_input') return !!a.text?.trim()
    if (qt === 'matching') return Object.keys(a.pairs ?? {}).length > 0
    return false
  }

  const unanswered = questions.filter(x => !isAnswered(x.id)).length

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-slate-700">
              Вопрос {current + 1} из {questions.length}
            </span>
            <span className="text-xs text-slate-400">· Отвечено: {answered}/{questions.length}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${(answered / questions.length) * 100}%` }} />
          </div>
        </div>
        <TimerDisplay seconds={timeLeft} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Question dots sidebar */}
        <div className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-2 overflow-y-auto shrink-0">
          {questions.map((x, i) => (
            <button key={x.id} onClick={() => goTo(i)}
              className={`w-9 h-9 rounded-lg text-xs font-medium transition-colors ${
                i === current
                  ? 'bg-blue-600 text-white'
                  : isAnswered(x.id)
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {i + 1}
            </button>
          ))}
        </div>

        {/* Main question area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto">
            {/* Question */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                  {q.score_max} {q.score_max === 1 ? 'балл' : 'баллов'}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  q.difficulty === 'easy' ? 'bg-green-100 text-green-600' :
                  q.difficulty === 'hard' ? 'bg-red-100 text-red-600' :
                  'bg-amber-100 text-amber-600'
                }`}>{q.difficulty}</span>
                {q.question_type === 'matching' && (
                  <span className="text-xs text-slate-400">Соотнесите элементы</span>
                )}
                {q.question_type === 'multiple_choice' && (
                  <span className="text-xs text-slate-400">Несколько правильных ответов</span>
                )}
              </div>
              {q.image_url && (
                <img src={q.image_url} alt="" className="w-full max-h-64 object-contain rounded-xl mb-4 border border-slate-100" />
              )}
              <p className="text-base text-slate-800 leading-relaxed">{q.body}</p>
            </div>

            {/* Answer input */}
            {q.question_type === 'single_choice' && (
              <SingleChoice question={q} answer={answers[q.id]} onChange={a => setAnswers(m => ({ ...m, [q.id]: a }))} />
            )}
            {q.question_type === 'multiple_choice' && (
              <MultipleChoice question={q} answer={answers[q.id]} onChange={a => setAnswers(m => ({ ...m, [q.id]: a }))} />
            )}
            {q.question_type === 'text_input' && (
              <TextInput answer={answers[q.id]} onChange={a => setAnswers(m => ({ ...m, [q.id]: a }))} />
            )}
            {q.question_type === 'matching' && (
              <MatchingInput question={q} answer={answers[q.id]} onChange={a => setAnswers(m => ({ ...m, [q.id]: a }))} />
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={() => goTo(current - 1)} disabled={current === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Назад
              </button>

              {current < questions.length - 1 ? (
                <button onClick={() => goTo(current + 1)}
                  className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
                  Далее
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={() => handleFinish(false)} disabled={submitting}
                  className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  {submitting ? 'Завершение...' : 'Завершить тест'}
                </button>
              )}
            </div>

            {/* Finish confirm warning */}
            {confirmFinish && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800 mb-3">
                  {unanswered > 0
                    ? `Остались без ответа: ${unanswered} вопросов. Завершить всё равно?`
                    : 'Завершить тест?'}
                </p>
                <div className="flex gap-3">
                  <button onClick={() => handleFinish(true)} disabled={submitting}
                    className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                    {submitting ? 'Завершение...' : 'Да, завершить'}
                  </button>
                  <button onClick={() => setConfirmFinish(false)}
                    className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
