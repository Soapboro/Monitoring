import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Paper, Typography, Button, LinearProgress, Chip, CircularProgress,
  Select, MenuItem, TextField,
} from '@mui/material'
import { TimerRounded, ArrowBackRounded, ArrowForwardRounded, ArrowRightAltRounded } from '@mui/icons-material'
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

type AnswerMap = Record<number, any>

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
  }, [limitMinutes]) // eslint-disable-line react-hooks/exhaustive-deps

  return left
}

function TimerDisplay({ seconds }: { seconds: number | null }) {
  if (seconds === null) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  const warn = seconds < 120
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.75,
      px: 1.5, py: 0.75, borderRadius: 1.5,
      bgcolor: warn ? '#FEE2E2' : '#F1F5F9',
      color: warn ? '#DC2626' : '#475569',
      animation: warn ? 'pulse 1s infinite' : 'none',
      fontFamily: 'monospace', fontWeight: 700, fontSize: 14,
    }}>
      <TimerRounded sx={{ fontSize: 16 }} />
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </Box>
  )
}

// ─── Answer editors ───────────────────────────────────────────────────────────

function SingleChoice({ question, answer, onChange }: {
  question: PlayerQuestion; answer: any; onChange: (a: any) => void
}) {
  const choices = question.options.choices ?? []
  const selected = answer?.selected ?? null
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {choices.map((ch, idx) => (
        <Paper
          key={`${ch.id}_${idx}`}
          variant="outlined"
          sx={{
            p: 2, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 1.5,
            borderWidth: 2,
            borderColor: selected === ch.id ? '#3B82F6' : 'divider',
            bgcolor: selected === ch.id ? '#EFF6FF' : 'background.paper',
            transition: 'all 0.15s',
            '&:hover': { borderColor: selected === ch.id ? '#3B82F6' : '#94A3B8' },
          }}
          onClick={() => onChange({ selected: ch.id })}
        >
          <Box sx={{
            width: 18, height: 18, borderRadius: '50%', border: 2,
            borderColor: selected === ch.id ? '#3B82F6' : '#CBD5E1',
            bgcolor: selected === ch.id ? '#3B82F6' : 'transparent',
            flexShrink: 0, mt: 0.25, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {selected === ch.id && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'white' }} />}
          </Box>
          <Box sx={{ flex: 1 }}>
            {ch.image_url && <Box component="img" src={ch.image_url} alt="" sx={{ height: 96, borderRadius: 1, mb: 1, objectFit: 'contain' }} />}
            <Typography variant="body2">{ch.text}</Typography>
          </Box>
        </Paper>
      ))}
    </Box>
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {choices.map((ch, idx) => (
        <Paper
          key={`${ch.id}_${idx}`}
          variant="outlined"
          sx={{
            p: 2, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 1.5,
            borderWidth: 2,
            borderColor: selected.includes(ch.id) ? '#3B82F6' : 'divider',
            bgcolor: selected.includes(ch.id) ? '#EFF6FF' : 'background.paper',
            transition: 'all 0.15s',
            '&:hover': { borderColor: selected.includes(ch.id) ? '#3B82F6' : '#94A3B8' },
          }}
          onClick={() => toggle(ch.id)}
        >
          <Box sx={{
            width: 16, height: 16, border: 2, borderRadius: 0.5,
            borderColor: selected.includes(ch.id) ? '#3B82F6' : '#CBD5E1',
            bgcolor: selected.includes(ch.id) ? '#3B82F6' : 'transparent',
            flexShrink: 0, mt: 0.25, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {selected.includes(ch.id) && (
              <Box component="span" sx={{ color: 'white', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</Box>
            )}
          </Box>
          <Box sx={{ flex: 1 }}>
            {ch.image_url && <Box component="img" src={ch.image_url} alt="" sx={{ height: 96, borderRadius: 1, mb: 1, objectFit: 'contain' }} />}
            <Typography variant="body2">{ch.text}</Typography>
          </Box>
        </Paper>
      ))}
    </Box>
  )
}

function TextInput({ answer, onChange }: { answer: any; onChange: (a: any) => void }) {
  return (
    <TextField
      fullWidth
      size="small"
      placeholder="Введите ответ..."
      value={answer?.text ?? ''}
      onChange={e => onChange({ text: e.target.value })}
      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
    />
  )
}

function MatchingInput({ question, answer, onChange }: {
  question: PlayerQuestion; answer: any; onChange: (a: any) => void
}) {
  const left = question.options.left ?? []
  const right = question.options.right ?? []
  const pairs: Record<string, string> = answer?.pairs ?? {}
  const [shuffledRight] = useState(() => [...right].sort(() => Math.random() - 0.5))

  function setPair(leftId: string, rightId: string) {
    onChange({ pairs: { ...pairs, [leftId]: rightId } })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {left.map(l => (
        <Paper key={l.id} variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderWidth: 2, borderColor: 'divider' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {l.image_url && <Box component="img" src={l.image_url} alt="" sx={{ height: 80, borderRadius: 1, mb: 1, objectFit: 'contain' }} />}
            <Typography variant="body2">{l.text}</Typography>
          </Box>
          <ArrowRightAltRounded sx={{ color: 'text.disabled', flexShrink: 0 }} />
          <Select
            size="small"
            value={pairs[l.id] ?? ''}
            onChange={e => setPair(l.id, e.target.value)}
            displayEmpty
            sx={{
              flex: 1, borderRadius: 2,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: pairs[l.id] ? '#60A5FA' : undefined,
              },
              bgcolor: pairs[l.id] ? '#EFF6FF' : 'background.paper',
            }}
          >
            <MenuItem value=""><em>Выберите...</em></MenuItem>
            {shuffledRight.map(r => (
              <MenuItem key={r.id} value={r.id}>{r.text || `Элемент ${r.id}`}</MenuItem>
            ))}
          </Select>
        </Paper>
      ))}
      {shuffledRight.some(r => r.image_url) && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mt: 1 }}>
          {shuffledRight.map(r => r.image_url && (
            <Box key={r.id} sx={{ textAlign: 'center' }}>
              <Box component="img" src={r.image_url} alt="" sx={{ height: 80, width: '100%', borderRadius: 1, objectFit: 'contain', border: 1, borderColor: 'divider' }} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{r.text}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

// ─── Results screen ───────────────────────────────────────────────────────────

function ResultsScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const pct = session.score_max
    ? Math.round((session.score_total ?? 0) / session.score_max * 100)
    : 0
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Paper elevation={3} sx={{ maxWidth: 400, width: '100%', p: 5, textAlign: 'center', borderRadius: 3 }}>
        <Box sx={{
          width: 80, height: 80, borderRadius: '50%', mx: 'auto', mb: 2,
          bgcolor: session.passed ? '#D1FAE5' : '#FEE2E2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{ fontSize: 32, color: session.passed ? '#059669' : '#DC2626' }}>
            {session.passed ? '✓' : '✗'}
          </Typography>
        </Box>
        <Typography variant="h5" fontWeight={700} sx={{ color: session.passed ? '#059669' : '#DC2626', mb: 0.5 }}>
          {session.passed ? 'Тест сдан!' : 'Тест не сдан'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {session.score_total?.toFixed(1)} из {session.score_max?.toFixed(1)} баллов
        </Typography>
        <Typography variant="h2" fontWeight={700} sx={{ mb: 1.5 }}>{pct}%</Typography>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 12, borderRadius: 6, mb: 4,
            bgcolor: '#E2E8F0',
            '& .MuiLinearProgress-bar': {
              bgcolor: session.passed ? '#34D399' : '#F87171',
              borderRadius: 6,
            },
          }}
        />
        <Button variant="contained" fullWidth size="large" onClick={onBack} sx={{ borderRadius: 2 }}>
          К списку тестов
        </Button>
      </Paper>
    </Box>
  )
}

// ─── Difficulty chip ──────────────────────────────────────────────────────────

const DIFF_SX: Record<string, { bgcolor: string; color: string }> = {
  easy:   { bgcolor: '#DCFCE7', color: '#16A34A' },
  medium: { bgcolor: '#FEF3C7', color: '#92400E' },
  hard:   { bgcolor: '#FEE2E2', color: '#DC2626' },
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
      await client.post(`/sessions/${sid}/answer`, { question_id: q.id, answer_data: data })
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
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
        <CircularProgress size={24} />
        <Typography>Загрузка теста...</Typography>
      </Box>
    </Box>
  )

  if (finished && session) return <ResultsScreen session={session} onBack={() => navigate('/my-tests')} />

  if (!q) return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Typography color="text.secondary">Вопросов нет</Typography>
    </Box>
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
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
            <Typography variant="body2" fontWeight={600}>
              Вопрос {current + 1} из {questions.length}
            </Typography>
            <Typography variant="caption" color="text.disabled">· Отвечено: {answered}/{questions.length}</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(answered / questions.length) * 100}
            sx={{
              height: 6, borderRadius: 3,
              bgcolor: '#F1F5F9',
              '& .MuiLinearProgress-bar': { bgcolor: '#3B82F6', borderRadius: 3 },
            }}
          />
        </Box>
        <TimerDisplay seconds={timeLeft} />
      </Box>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Question dots sidebar */}
        <Box sx={{
          width: 64, bgcolor: 'background.paper', borderRight: 1, borderColor: 'divider',
          display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2, gap: 1, overflowY: 'auto', flexShrink: 0,
        }}>
          {questions.map((x, i) => (
            <Box
              key={x.id}
              onClick={() => goTo(i)}
              sx={{
                width: 36, height: 36, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                bgcolor: i === current ? '#2563EB' : isAnswered(x.id) ? '#D1FAE5' : '#F1F5F9',
                color: i === current ? 'white' : isAnswered(x.id) ? '#065F46' : '#64748B',
                '&:hover': { opacity: 0.8 },
              }}
            >
              {i + 1}
            </Box>
          ))}
        </Box>

        {/* Main question area */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 4 }}>
          <Box sx={{ maxWidth: 640, mx: 'auto' }}>
            {/* Question card */}
            <Paper elevation={1} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip label={`${q.score_max} ${q.score_max === 1 ? 'балл' : 'баллов'}`} size="small" sx={{ bgcolor: '#DBEAFE', color: '#1D4ED8', fontWeight: 600 }} />
                <Chip label={q.difficulty} size="small" sx={DIFF_SX[q.difficulty] ?? { bgcolor: '#F1F5F9', color: '#64748b' }} />
                {q.question_type === 'matching' && (
                  <Typography variant="caption" color="text.disabled">Соотнесите элементы</Typography>
                )}
                {q.question_type === 'multiple_choice' && (
                  <Typography variant="caption" color="text.disabled">Несколько правильных ответов</Typography>
                )}
              </Box>
              {q.image_url && (
                <Box component="img" src={q.image_url} alt="" sx={{ width: '100%', maxHeight: 256, objectFit: 'contain', borderRadius: 2, mb: 2, border: 1, borderColor: 'divider' }} />
              )}
              <Typography variant="body1" sx={{ lineHeight: 1.7 }}>{q.body}</Typography>
            </Paper>

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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 4 }}>
              <Button
                variant="outlined" size="small" startIcon={<ArrowBackRounded />}
                disabled={current === 0}
                onClick={() => goTo(current - 1)}
                sx={{ borderColor: 'divider', color: 'text.primary', borderRadius: 2 }}
              >
                Назад
              </Button>

              {current < questions.length - 1 ? (
                <Button
                  variant="contained" size="small" endIcon={<ArrowForwardRounded />}
                  onClick={() => goTo(current + 1)}
                  sx={{ borderRadius: 2 }}
                >
                  Далее
                </Button>
              ) : (
                <Button
                  variant="contained" size="small" color="success"
                  disabled={submitting}
                  onClick={() => handleFinish(false)}
                  sx={{ borderRadius: 2 }}
                >
                  {submitting ? 'Завершение...' : 'Завершить тест'}
                </Button>
              )}
            </Box>

            {/* Finish confirm warning */}
            {confirmFinish && (
              <Paper variant="outlined" sx={{ mt: 2, p: 2, borderColor: '#FCD34D', bgcolor: '#FFFBEB', borderRadius: 2 }}>
                <Typography variant="body2" sx={{ color: '#92400E', mb: 1.5 }}>
                  {unanswered > 0
                    ? `Остались без ответа: ${unanswered} вопросов. Завершить всё равно?`
                    : 'Завершить тест?'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Button variant="contained" color="success" size="small" disabled={submitting} onClick={() => handleFinish(true)} sx={{ borderRadius: 1.5 }}>
                    {submitting ? 'Завершение...' : 'Да, завершить'}
                  </Button>
                  <Button variant="outlined" size="small" onClick={() => setConfirmFinish(false)} sx={{ borderColor: 'divider', color: 'text.primary', borderRadius: 1.5 }}>
                    Отмена
                  </Button>
                </Box>
              </Paper>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
