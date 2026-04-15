import { useEffect, useState } from 'react'
import {
  Box, Paper, Typography, CircularProgress, Tabs, Tab,
  Table, TableHead, TableBody, TableRow, TableCell,
  LinearProgress, MenuItem, TextField, Chip, Tooltip,
} from '@mui/material'
import {
  ErrorOutlineRounded, CheckCircleOutlineRounded, TimerRounded,
  SchoolRounded,
} from '@mui/icons-material'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import {
  getQuestionStats, getTestDurations, getTopicMastery, getStudentWeaknesses,
} from '../../api/analytics'
import type {
  QuestionStat, TestDuration, TopicMastery, StudentWeakness,
} from '../../api/analytics'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import client from '../../api/client'

interface TestMeta { id: number; title: string; subject: string }

function fmtSec(sec: number | null): string {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return m > 0 ? `${m}м ${s}с` : `${s}с`
}

function MasteryBar({ pct }: { pct: number | null }) {
  const v = pct ?? 0
  const color = v >= 70 ? '#347856' : v >= 40 ? '#1D4ED8' : '#C9874A'
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
      <LinearProgress
        variant="determinate" value={v}
        sx={{
          width: 80, height: 6, borderRadius: 3, bgcolor: '#e2e8f0',
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 38, textAlign: 'right' }}>
        {pct != null ? `${pct}%` : '—'}
      </Typography>
    </Box>
  )
}

/* ─── Tab 1: Question stats ─── */
function QuestionStatsTab({ tests }: { tests: TestMeta[] }) {
  const [testId, setTestId] = useState<number | ''>('')
  const [rows, setRows] = useState<QuestionStat[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!testId) { setRows([]); return }
    setLoading(true)
    getQuestionStats(testId as number).then(setRows).finally(() => setLoading(false))
  }, [testId])

  const chartData = rows.map(r => ({
    name: `В${r.order_index + 1}`,
    error: r.error_rate_pct ?? 0,
    time: r.avg_time_sec ?? 0,
    topic: r.topic ?? '—',
    text: r.question_text.slice(0, 80),
    attempts: r.attempts,
  }))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <TextField
        select label="Выберите тест" size="small" value={testId}
        onChange={e => setTestId(Number(e.target.value))}
        sx={{ maxWidth: 400 }}
      >
        {tests.map(t => (
          <MenuItem key={t.id} value={t.id}>{t.title} — {t.subject}</MenuItem>
        ))}
      </TextField>

      {loading && <CircularProgress size={28} />}

      {rows.length > 0 && (
        <>
          <Paper elevation={1} sx={{ p: 3 }}>
            <Typography variant="subtitle2" fontWeight={600} mb={2}>Частота ошибок по вопросам (%)</Typography>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                <RTooltip
                  formatter={(v: number) => [`${v.toFixed(1)}%`, 'Ошибок']}
                  labelFormatter={(_, p) => {
                    const d = p?.[0]?.payload
                    return d ? `${d.name}: ${d.text}` : ''
                  }}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.error >= 60 ? '#C9874A' : entry.error >= 30 ? '#1D4ED8' : '#347856'} />
                ))}
                <Bar dataKey="error" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.error >= 60 ? '#C9874A' : entry.error >= 30 ? '#1D4ED8' : '#347856'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>

          <Paper elevation={2} sx={{ overflow: 'hidden' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 48 }}>#</TableCell>
                  <TableCell>Вопрос</TableCell>
                  <TableCell>Тема</TableCell>
                  <TableCell align="right">Попыток</TableCell>
                  <TableCell align="right">Ошибок</TableCell>
                  <TableCell align="right">Ср. время</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(r => {
                  const errPct = r.error_rate_pct ?? 0
                  const errColor = errPct >= 60 ? '#C9874A' : errPct >= 30 ? '#1D4ED8' : '#347856'
                  return (
                    <TableRow key={r.test_question_id} hover>
                      <TableCell sx={{ color: 'text.disabled', fontWeight: 500 }}>{r.order_index + 1}</TableCell>
                      <TableCell>
                        <Tooltip title={r.question_text} placement="top">
                          <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.question_text}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{r.topic ?? '—'}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{r.attempts}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={`${errPct.toFixed(1)}%`}
                          sx={{ bgcolor: `${errColor}18`, color: errColor, fontWeight: 600, fontSize: 11 }}
                          icon={errPct >= 50
                            ? <ErrorOutlineRounded sx={{ fontSize: '14px !important', color: `${errColor} !important` }} />
                            : <CheckCircleOutlineRounded sx={{ fontSize: '14px !important', color: `${errColor} !important` }} />}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                          <TimerRounded sx={{ fontSize: 14, color: 'text.disabled' }} />
                          <Typography variant="caption" color="text.secondary">{fmtSec(r.avg_time_sec)}</Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {!loading && testId && rows.length === 0 && (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <Typography color="text.secondary">Нет данных по этому тесту</Typography>
        </Paper>
      )}
    </Box>
  )
}

/* ─── Tab 2: Test durations ─── */
function TestDurationsTab() {
  const [rows, setRows] = useState<TestDuration[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTestDurations().then(setRows).finally(() => setLoading(false))
  }, [])

  if (loading) return <CircularProgress size={28} />
  if (rows.length === 0) return (
    <Paper sx={{ p: 5, textAlign: 'center' }}>
      <Typography color="text.secondary">Нет данных о прохождении тестов</Typography>
    </Paper>
  )

  const chartData = rows.map(r => ({
    name: r.title.length > 18 ? r.title.slice(0, 16) + '…' : r.title,
    fullName: r.title,
    avg: Math.round((r.avg_duration_sec ?? 0) / 60 * 10) / 10,
    min: Math.round((r.min_duration_sec ?? 0) / 60 * 10) / 10,
    max: Math.round((r.max_duration_sec ?? 0) / 60 * 10) / 10,
    attempts: r.attempts,
  }))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper elevation={1} sx={{ p: 3 }}>
        <Typography variant="subtitle2" fontWeight={600} mb={2}>Время прохождения (минуты)</Typography>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 0, right: 16, left: -10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="м" />
            <RTooltip
              formatter={(v: number, key: string) => [`${v} мин`, key === 'avg' ? 'Среднее' : key === 'min' ? 'Мин' : 'Макс']}
              labelFormatter={(_, p) => {
                const d = p?.[0]?.payload
                return d ? `${d.fullName} (${d.attempts} попыток)` : ''
              }}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="avg" fill="#C9874A" radius={[4, 4, 0, 0]} name="avg" />
            <Bar dataKey="min" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="min" />
            <Bar dataKey="max" fill="#347856" radius={[4, 4, 0, 0]} name="max" />
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      <Paper elevation={2} sx={{ overflow: 'hidden' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Тест</TableCell>
              <TableCell>Предмет</TableCell>
              <TableCell align="right">Попыток</TableCell>
              <TableCell align="right">Мин</TableCell>
              <TableCell align="right">Среднее</TableCell>
              <TableCell align="right">Макс</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.test_id} hover>
                <TableCell sx={{ fontWeight: 500 }}>{r.title}</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{r.subject}</TableCell>
                <TableCell align="right">{r.attempts}</TableCell>
                <TableCell align="right">
                  <Typography variant="caption" color="text.secondary">{fmtSec(r.min_duration_sec)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                    <TimerRounded sx={{ fontSize: 14, color: 'text.disabled' }} />
                    <Typography variant="body2" fontWeight={600}>{fmtSec(r.avg_duration_sec)}</Typography>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="caption" color="text.secondary">{fmtSec(r.max_duration_sec)}</Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  )
}

/* ─── Tab 3: Topic mastery ─── */
function TopicMasteryTab({ groupIds, groupNames }: { groupIds: number[]; groupNames: Record<number, string> }) {
  const [groupId, setGroupId] = useState<number | ''>(groupIds[0] ?? '')
  const [rows, setRows] = useState<TopicMastery[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!groupId) { setRows([]); return }
    setLoading(true)
    getTopicMastery(groupId as number).then(setRows).finally(() => setLoading(false))
  }, [groupId])

  const chartData = rows.map(r => ({
    name: r.topic.length > 18 ? r.topic.slice(0, 16) + '…' : r.topic,
    fullName: r.topic,
    pct: r.correct_pct ?? 0,
    attempts: r.attempts,
  }))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {groupIds.length > 1 && (
        <TextField
          select label="Группа" size="small" value={groupId}
          onChange={e => setGroupId(Number(e.target.value))}
          sx={{ maxWidth: 300 }}
        >
          {groupIds.map(id => (
            <MenuItem key={id} value={id}>{groupNames[id] ?? `Группа ${id}`}</MenuItem>
          ))}
        </TextField>
      )}

      {loading && <CircularProgress size={28} />}

      {rows.length > 0 && (
        <>
          <Paper elevation={1} sx={{ p: 3 }}>
            <Typography variant="subtitle2" fontWeight={600} mb={2}>Освоенность тем (%)</Typography>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 60, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={110} />
                <RTooltip
                  formatter={(v: number) => [`${v.toFixed(1)}%`, 'Верных ответов']}
                  labelFormatter={(_, p) => {
                    const d = p?.[0]?.payload
                    return d ? `${d.fullName} (${d.attempts} попыток)` : ''
                  }}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.pct >= 70 ? '#347856' : entry.pct >= 40 ? '#1D4ED8' : '#C9874A'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>

          <Paper elevation={2} sx={{ overflow: 'hidden' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Тема</TableCell>
                  <TableCell align="right">Попыток</TableCell>
                  <TableCell align="right">Верных</TableCell>
                  <TableCell align="right">Освоенность</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.topic_id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{r.topic}</TableCell>
                    <TableCell align="right">{r.attempts}</TableCell>
                    <TableCell align="right">{r.correct_count}</TableCell>
                    <TableCell align="right"><MasteryBar pct={r.correct_pct} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {!loading && groupId && rows.length === 0 && (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <Typography color="text.secondary">Нет данных по этой группе</Typography>
        </Paper>
      )}
    </Box>
  )
}

/* ─── Tab 4: Student weaknesses ─── */
function StudentWeaknessesTab({ groupIds, groupNames }: { groupIds: number[]; groupNames: Record<number, string> }) {
  const [groupId, setGroupId] = useState<number | ''>(groupIds[0] ?? '')
  const [rows, setRows] = useState<StudentWeakness[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!groupId) { setRows([]); return }
    setLoading(true)
    getStudentWeaknesses(groupId as number).then(setRows).finally(() => setLoading(false))
  }, [groupId])

  // Group by student
  const byStudent = new Map<number, { name: string; topics: StudentWeakness[] }>()
  for (const r of rows) {
    if (!byStudent.has(r.student_id)) {
      byStudent.set(r.student_id, { name: r.student_name, topics: [] })
    }
    byStudent.get(r.student_id)!.topics.push(r)
  }
  const students = Array.from(byStudent.entries()).map(([id, v]) => ({ id, ...v }))
  // Sort students by avg correct pct ascending (weakest first)
  students.sort((a, b) => {
    const avgA = a.topics.reduce((s, t) => s + (t.correct_pct ?? 0), 0) / (a.topics.length || 1)
    const avgB = b.topics.reduce((s, t) => s + (t.correct_pct ?? 0), 0) / (b.topics.length || 1)
    return avgA - avgB
  })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {groupIds.length > 1 && (
        <TextField
          select label="Группа" size="small" value={groupId}
          onChange={e => setGroupId(Number(e.target.value))}
          sx={{ maxWidth: 300 }}
        >
          {groupIds.map(id => (
            <MenuItem key={id} value={id}>{groupNames[id] ?? `Группа ${id}`}</MenuItem>
          ))}
        </TextField>
      )}

      {loading && <CircularProgress size={28} />}

      {students.length > 0 && students.map(student => {
        const weakTopics = student.topics.filter(t => (t.correct_pct ?? 100) < 50)
        const avgPct = student.topics.reduce((s, t) => s + (t.correct_pct ?? 0), 0) / student.topics.length
        return (
          <Paper key={student.id} elevation={2} sx={{ overflow: 'hidden' }}>
            <Box sx={{ px: 3, py: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <SchoolRounded sx={{ fontSize: 18, color: 'text.disabled' }} />
              <Typography variant="subtitle2" fontWeight={600}>{student.name}</Typography>
              <Box sx={{ flex: 1 }} />
              {weakTopics.length > 0 && (
                <Chip size="small" label={`${weakTopics.length} проблемных тем`}
                  sx={{ bgcolor: '#F5E2CE', color: '#C9874A', fontSize: 11 }} />
              )}
              <Chip size="small" label={`Ср. ${avgPct.toFixed(0)}%`}
                sx={{
                  bgcolor: avgPct >= 70 ? '#D4EDDF' : avgPct >= 40 ? '#DBEAFE' : '#F5E2CE',
                  color: avgPct >= 70 ? '#347856' : avgPct >= 40 ? '#1D4ED8' : '#C9874A',
                  fontSize: 11, fontWeight: 600,
                }} />
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Тема</TableCell>
                  <TableCell align="right">Попыток</TableCell>
                  <TableCell align="right">Верных</TableCell>
                  <TableCell align="right">Результат</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {student.topics
                  .slice()
                  .sort((a, b) => (a.correct_pct ?? 0) - (b.correct_pct ?? 0))
                  .map(t => (
                    <TableRow key={t.topic_id} hover
                      sx={(t.correct_pct ?? 100) < 50 ? { bgcolor: '#FFF7F0' } : {}}>
                      <TableCell sx={{ fontWeight: (t.correct_pct ?? 100) < 50 ? 600 : 400 }}>
                        {(t.correct_pct ?? 100) < 50 && (
                          <ErrorOutlineRounded sx={{ fontSize: 14, color: '#C9874A', mr: 0.5, verticalAlign: 'middle' }} />
                        )}
                        {t.topic}
                      </TableCell>
                      <TableCell align="right">{t.attempts}</TableCell>
                      <TableCell align="right">{t.correct_count}</TableCell>
                      <TableCell align="right"><MasteryBar pct={t.correct_pct} /></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Paper>
        )
      })}

      {!loading && groupId && students.length === 0 && (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <Typography color="text.secondary">Нет данных по этой группе</Typography>
        </Paper>
      )}
    </Box>
  )
}

/* ─── Main page ─── */
export default function TestAnalyticsPage() {
  const [tab, setTab] = useState(0)
  const [tests, setTests] = useState<TestMeta[]>([])
  const [groupIds, setGroupIds] = useState<number[]>([])
  const [groupNames, setGroupNames] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const teacher = await getMyTeacherProfile()
      const [testsData, assignments, groups] = await Promise.all([
        client.get<{ id: number; title: string; subject_id: number }[]>('/tests').then(r => r.data),
        getAssignments(teacher.id),
        client.get<{ id: number; name: string }[]>('/groups').then(r => r.data),
      ])
      const subjects = await client.get<{ id: number; name: string }[]>('/subjects').then(r => r.data)
      const subjectMap: Record<number, string> = {}
      for (const s of subjects) subjectMap[s.id] = s.name

      setTests(testsData.map(t => ({ id: t.id, title: t.title, subject: subjectMap[t.subject_id] ?? '' })))

      const ids = [...new Set(assignments.map(a => a.group_id))]
      setGroupIds(ids)
      const nameMap: Record<number, string> = {}
      for (const g of groups) nameMap[g.id] = g.name
      setGroupNames(nameMap)
      setLoading(false)
    }
    init()
  }, [])

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
  )

  return (
    <Box sx={{ p: 4, maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>Аналитика по тестам</Typography>
        <Typography variant="body2" color="text.secondary">
          Детальная статистика: ошибки по вопросам, время прохождения, освоенность тем
        </Typography>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Ошибки по вопросам" />
        <Tab label="Время прохождения" />
        <Tab label="Освоенность тем" />
        <Tab label="Проблемы студентов" />
      </Tabs>

      <Box>
        {tab === 0 && <QuestionStatsTab tests={tests} />}
        {tab === 1 && <TestDurationsTab />}
        {tab === 2 && <TopicMasteryTab groupIds={groupIds} groupNames={groupNames} />}
        {tab === 3 && <StudentWeaknessesTab groupIds={groupIds} groupNames={groupNames} />}
      </Box>
    </Box>
  )
}
