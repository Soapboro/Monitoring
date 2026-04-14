import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, Chip, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell,
  Button, Tabs, Tab,
} from '@mui/material'
import { TimerRounded } from '@mui/icons-material'
import client from '../../api/client'
import { getMySessions, getSubjects } from '../../api/resources'
import type { TestSession, Subject } from '../../api/resources'

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

const AVAIL_STATUS_SX: Record<string, { bgcolor: string; color: string }> = {
  available:   { bgcolor: '#DBEAFE', color: '#1D4ED8' },
  in_progress: { bgcolor: '#FEF3C7', color: '#92400E' },
  passed:      { bgcolor: '#D4EDDF', color: '#347856' },
  exhausted:   { bgcolor: '#F1F5F9', color: '#64748b' },
  expired:     { bgcolor: '#F4D0CC', color: '#D05050' },
}
const AVAIL_STATUS_LABEL: Record<string, string> = {
  available: 'Доступен', in_progress: 'В процессе', passed: 'Сдан', exhausted: 'Попытки исчерпаны', expired: 'Истёк срок',
}
const SESSION_STATUS_SX: Record<string, { bgcolor: string; color: string }> = {
  completed:   { bgcolor: '#D4EDDF', color: '#347856' },
  in_progress: { bgcolor: '#FEF3C7', color: '#92400E' },
  timed_out:   { bgcolor: '#F4D0CC', color: '#D05050' },
  abandoned:   { bgcolor: '#F1F5F9', color: '#64748b' },
}
const SESSION_STATUS_LABEL: Record<string, string> = {
  completed: 'Завершён', in_progress: 'В процессе', timed_out: 'Время вышло', abandoned: 'Прерван',
}

function AvailableTab({ subjects }: { subjects: Subject[] }) {
  const navigate = useNavigate()
  const [tests, setTests] = useState<AvailableTest[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<number | null>(null)

  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s.name]))

  useEffect(() => {
    client.get<AvailableTest[]>('/tests/my-available').then(r => setTests(r.data)).finally(() => setLoading(false))
  }, [])

  const startOrContinue = async (t: AvailableTest) => {
    if (t.status === 'in_progress' && t.session_id) { navigate(`/my-tests/session/${t.session_id}`); return }
    setStarting(t.test_id)
    try {
      const { data } = await client.post<{ id: number }>(`/sessions/start/${t.test_id}`)
      navigate(`/my-tests/session/${data.id}`)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(msg ?? 'Ошибка запуска теста')
    } finally { setStarting(null) }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
  if (tests.length === 0) return <Paper sx={{ p: 6, textAlign: 'center' }}><Typography color="text.secondary">Тестов пока нет</Typography></Paper>

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {tests.map(t => {
        const canStart = t.status === 'available' || t.status === 'in_progress'
        return (
          <Paper key={t.test_id} elevation={1} sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 0.75 }}>
                  <Typography variant="subtitle2" fontWeight={600}>{t.title}</Typography>
                  <Chip label={AVAIL_STATUS_LABEL[t.status]} size="small" sx={AVAIL_STATUS_SX[t.status]} />
                </Box>
                {t.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {t.description}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <Typography variant="caption" color="text.disabled">{subjectMap[t.subject_id] ?? `Предмет ${t.subject_id}`}</Typography>
                  {t.time_limit_minutes && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <TimerRounded sx={{ fontSize: 13, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.disabled">{t.time_limit_minutes} мин</Typography>
                    </Box>
                  )}
                  <Typography variant="caption" color="text.disabled">Попытки: {t.attempts_used}/{t.attempts_allowed}</Typography>
                  <Typography variant="caption" color="text.disabled">Порог: {t.passing_score_pct}%</Typography>
                  {t.available_to && (
                    <Typography variant="caption" color="text.disabled">до {new Date(t.available_to).toLocaleDateString('ru')}</Typography>
                  )}
                  {t.best_pct !== null && (
                    <Typography variant="caption" sx={{ color: '#347856', fontWeight: 600 }}>Лучший: {t.best_pct}%</Typography>
                  )}
                </Box>
              </Box>
              {canStart && (
                <Button
                  variant="contained"
                  size="small"
                  disabled={starting === t.test_id}
                  onClick={() => startOrContinue(t)}
                  sx={{ flexShrink: 0, bgcolor: t.status === 'in_progress' ? '#C9874A' : undefined, '&:hover': { bgcolor: t.status === 'in_progress' ? '#b07240' : undefined } }}
                >
                  {starting === t.test_id ? 'Загрузка...' : t.status === 'in_progress' ? 'Продолжить' : 'Начать'}
                </Button>
              )}
            </Box>
          </Paper>
        )
      })}
    </Box>
  )
}

function HistoryTab() {
  const [sessions, setSessions] = useState<TestSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { getMySessions().then(setSessions).finally(() => setLoading(false)) }, [])

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
  if (sessions.length === 0) return <Paper sx={{ p: 6, textAlign: 'center' }}><Typography color="text.secondary">Истории нет</Typography></Paper>

  return (
    <Paper elevation={2} sx={{ overflow: 'hidden' }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Дата</TableCell>
            <TableCell>Тест</TableCell>
            <TableCell align="center">Статус</TableCell>
            <TableCell align="right">Баллы</TableCell>
            <TableCell align="right">Результат</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sessions.map(s => {
            const pct = s.score_max && s.score_max > 0 ? Math.round((s.score_total ?? 0) / s.score_max * 100) : null
            const statusSx = SESSION_STATUS_SX[s.status] ?? { bgcolor: '#F1F5F9', color: '#64748b' }
            const statusLabel = SESSION_STATUS_LABEL[s.status] ?? s.status
            const resultSx = s.passed === true ? { bgcolor: '#D4EDDF', color: '#347856' } :
                             s.passed === false ? { bgcolor: '#F4D0CC', color: '#D05050' } :
                             { bgcolor: '#F1F5F9', color: '#64748b' }
            return (
              <TableRow key={s.id} hover>
                <TableCell sx={{ color: 'text.secondary' }}>{new Date(s.started_at).toLocaleDateString('ru')}</TableCell>
                <TableCell>Тест #{s.test_id}</TableCell>
                <TableCell align="center">
                  <Chip label={statusLabel} size="small" sx={statusSx} />
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>
                  {s.score_total !== null && s.score_max !== null ? `${s.score_total} / ${s.score_max}` : '—'}
                </TableCell>
                <TableCell align="right">
                  {pct !== null
                    ? <Chip label={`${pct}%`} size="small" sx={resultSx} />
                    : <Typography variant="body2" color="text.disabled">—</Typography>}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Paper>
  )
}

export default function MyTestsPage() {
  const [tab, setTab] = useState(0)
  const [subjects, setSubjects] = useState<Subject[]>([])

  useEffect(() => { getSubjects().then(setSubjects).catch(() => {}) }, [])

  return (
    <Box sx={{ p: 4, maxWidth: 800 }}>
      <Typography variant="h5" fontWeight={700}>Мои тесты</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Доступные тесты и история прохождений</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Доступные" />
        <Tab label="История" />
      </Tabs>

      {tab === 0 && <AvailableTab subjects={subjects} />}
      {tab === 1 && <HistoryTab />}
    </Box>
  )
}
