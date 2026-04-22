import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, Chip, CircularProgress, Breadcrumbs, Link,
  Table, TableHead, TableBody, TableRow, TableCell, Button, Stack,
} from '@mui/material'
import { ChevronRightRounded, TableChartRounded, PictureAsPdfRounded } from '@mui/icons-material'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import client from '../../api/client'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import type { StudentProfile, TeachingAssignment, Subject, GradeRecord, AttendanceRecord } from '../../api/resources'
import { getStudentDynamics } from '../../api/analytics'
import type { StudentDynamics } from '../../api/analytics'
import { downloadStudentExcel, downloadStudentPdf } from '../../api/reports'
import { WARM } from '../../theme'

interface TestSession {
  id: number; test_id: number; student_id: number; attempt_number: number
  status: string; started_at: string; finished_at: string | null
  score_total: number | null; score_max: number | null; passed: boolean | null
}
interface TestInfo {
  id: number; title: string; subject_id: number; attempts_allowed: number
  passing_score_pct: number; status: string
}
interface AssignmentWithSubject extends TeachingAssignment { subjectName: string }

const GRADE_TYPE_LABELS: Record<string, string> = {
  current: 'Текущая', thematic: 'Тематическая', midterm: 'Промежуточная',
  final: 'Итоговая', attendance: 'За посещ.',
}

const gradeChip = (v: number) =>
  v >= 4 ? { bgcolor: '#D4EDDF', color: '#347856' } :
  v >= 3 ? { bgcolor: '#DBEAFE', color: '#1D4ED8' } :
           { bgcolor: '#F4D0CC', color: '#D05050' }

export default function TeacherStudentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const studentId = Number(id)

  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [groupName, setGroupName] = useState('')
  const [assignments, setAssignments] = useState<AssignmentWithSubject[]>([])
  const [grades, setGrades] = useState<GradeRecord[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [sessions, setSessions] = useState<TestSession[]>([])
  const [tests, setTests] = useState<Record<number, TestInfo>>({})
  const [dynamics, setDynamics] = useState<StudentDynamics | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState<number | null>(null)
  const [resetMsg, setResetMsg] = useState<Record<number, string>>({})
  const [exportBusy, setExportBusy] = useState<'excel' | 'pdf' | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [teacherProfile, studentData] = await Promise.all([
        getMyTeacherProfile(),
        client.get<StudentProfile>(`/students/${studentId}`).then(r => r.data),
      ])
      setStudent(studentData)

      const [teacherAssignments, groupData] = await Promise.all([
        getAssignments(teacherProfile.id),
        client.get<{ id: number; name: string }>(`/groups/${studentData.group_id}`).then(r => r.data),
      ])
      setGroupName(groupData.name)

      const myAssignments = teacherAssignments.filter(a => a.group_id === studentData.group_id)
      const subjectIds = [...new Set(myAssignments.map(a => a.subject_id))]
      const subjectMap: Record<number, string> = {}
      await Promise.all(subjectIds.map(async sid => {
        const s = await client.get<Subject>(`/subjects/${sid}`).then(r => r.data)
        subjectMap[sid] = s.name
      }))

      const enriched: AssignmentWithSubject[] = myAssignments.map(a => ({ ...a, subjectName: subjectMap[a.subject_id] ?? '—' }))
      setAssignments(enriched)

      const [allGrades, allAtt, rawSessions, dyn] = await Promise.all([
        Promise.all(myAssignments.map(a => client.get<GradeRecord[]>('/grades', { params: { assignment_id: a.id, student_id: studentId } }).then(r => r.data))).then(arrays => arrays.flat()),
        Promise.all(myAssignments.map(a => client.get<AttendanceRecord[]>('/attendance', { params: { assignment_id: a.id, student_id: studentId } }).then(r => r.data))).then(arrays => arrays.flat()),
        client.get<TestSession[]>(`/sessions/student/${studentId}`).then(r => r.data),
        getStudentDynamics(studentId).catch(() => null),
      ])
      setDynamics(dyn)

      setGrades(allGrades.sort((a, b) => b.date_recorded.localeCompare(a.date_recorded)))
      setAttendance(allAtt.sort((a, b) => b.lesson_date.localeCompare(a.lesson_date)))
      setSessions(rawSessions)

      const testIds = [...new Set(rawSessions.map(s => s.test_id))]
      const testMap: Record<number, TestInfo> = {}
      await Promise.all(testIds.map(async tid => {
        try { testMap[tid] = await client.get<TestInfo>(`/tests/${tid}`).then(r => r.data) } catch { /* silent */ }
      }))
      setTests(testMap)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [studentId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleResetTest = async (testId: number) => {
    setResetting(testId)
    try {
      await client.delete(`/sessions/student/${studentId}/test/${testId}/reset`)
      setResetMsg(prev => ({ ...prev, [testId]: 'Попытки сброшены — студент может пройти заново' }))
      setTimeout(() => setResetMsg(prev => { const n = { ...prev }; delete n[testId]; return n }), 4000)
      await load()
    } finally { setResetting(null) }
  }

  const presentCount = attendance.filter(a => a.is_present).length
  const attendRate = attendance.length > 0 ? Math.round(presentCount / attendance.length * 100) : null

  const sessionsByTest: Record<number, TestSession[]> = {}
  for (const s of sessions) {
    if (!sessionsByTest[s.test_id]) sessionsByTest[s.test_id] = []
    sessionsByTest[s.test_id].push(s)
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
  if (!student) return <Typography sx={{ p: 4 }} color="text.secondary">Студент не найден</Typography>

  const fullName = [student.last_name, student.first_name, student.middle_name].filter(Boolean).join(' ')

  const numGrades = grades.filter(g => g.value != null)
  const avgGrade = numGrades.length > 0 ? (numGrades.reduce((s, g) => s + g.value!, 0) / numGrades.length) : null

  return (
    <Box sx={{ p: 4, maxWidth: 900 }}>
      <Breadcrumbs separator={<ChevronRightRounded sx={{ fontSize: 14 }} />} sx={{ mb: 3, fontSize: 13 }}>
        <Link underline="hover" sx={{ cursor: 'pointer' }} color="inherit" onClick={() => navigate('/analytics')}>Аналитика</Link>
        <Typography fontSize={13} color="text.primary" fontWeight={500}>{fullName}</Typography>
      </Breadcrumbs>

      {/* Student header */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Typography variant="h5" fontWeight={700} sx={{ color: '#1D4ED8' }}>{student.last_name[0]}</Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={600}>{fullName}</Typography>
            <Typography variant="body2" color="text.secondary">
              {groupName}{student.student_num ? ` · № ${student.student_num}` : ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexShrink={0}>
            <Button
              size="small" variant="outlined"
              startIcon={exportBusy === 'excel' ? <CircularProgress size={12} /> : <TableChartRounded fontSize="small" />}
              disabled={exportBusy !== null}
              onClick={async () => {
                setExportBusy('excel')
                try { await downloadStudentExcel(studentId) } catch { /* silent */ } finally { setExportBusy(null) }
              }}
            >
              {exportBusy === 'excel' ? '...' : 'Excel'}
            </Button>
            <Button
              size="small" variant="outlined" color="error"
              startIcon={exportBusy === 'pdf' ? <CircularProgress size={12} /> : <PictureAsPdfRounded fontSize="small" />}
              disabled={exportBusy !== null}
              onClick={async () => {
                setExportBusy('pdf')
                try { await downloadStudentPdf(studentId) } catch { /* silent */ } finally { setExportBusy(null) }
              }}
            >
              {exportBusy === 'pdf' ? '...' : 'PDF'}
            </Button>
          </Stack>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mt: 2.5, pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Предметов</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: WARM[800] }}>{assignments.length}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Средний балл</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: avgGrade !== null ? (avgGrade >= 4 ? '#347856' : '#C9874A') : WARM[800] }}>
              {avgGrade !== null ? avgGrade.toFixed(2) : '—'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Посещаемость</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: attendRate !== null ? (attendRate >= 75 ? '#347856' : attendRate >= 50 ? '#C9874A' : '#D05050') : WARM[800] }}>
              {attendRate !== null ? `${attendRate}%` : '—'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Тестов пройдено</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: WARM[800] }}>{sessions.filter(s => s.status === 'completed').length}</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Dynamics chart */}
      {dynamics && dynamics.periods.length > 1 && (() => {
        const allSubjects = [...new Set(dynamics.by_subject.map(r => r.subject))]
        const byPeriod = new Map<string, Record<string, number>>()
        dynamics.periods.forEach(p => {
          byPeriod.set(`${p.acad_year} · сем.${p.semester}`, { avg: Number(p.avg_grade) })
        })
        dynamics.by_subject.forEach(r => {
          const key = `${r.acad_year} · сем.${r.semester}`
          const entry = byPeriod.get(key)
          if (entry) entry[r.subject] = Number(r.avg_grade)
        })
        const chartData = Array.from(byPeriod.entries()).map(([period, vals]) => ({ period, ...vals }))
        const COLORS = ['#C9874A', '#347856', '#1D4ED8', '#9333ea', '#0891b2', '#dc2626']
        return (
          <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>Динамика успеваемости по семестрам</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Средний балл — общий и по дисциплинам
            </Typography>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: -10, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} angle={-30} textAnchor="end" interval={0} />
                <YAxis domain={[1, 5]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <ReferenceLine y={3} stroke="#e2e8f0" strokeDasharray="4 2" />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [v.toFixed(2), '']} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Line type="monotone" dataKey="avg" name="Средний" stroke="#1D4ED8" strokeWidth={2.5} dot={{ r: 5 }} activeDot={{ r: 7 }} connectNulls />
                {allSubjects.slice(0, 5).map((s, i) => (
                  <Line key={s} type="monotone" dataKey={s} stroke={COLORS[i]} strokeWidth={1.5} dot={{ r: 3 }} strokeDasharray="5 3" connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        )
      })()}

      {/* Subjects */}
      {assignments.length > 0 && (
        <Section title="Дисциплины" count={assignments.length}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, p: 2 }}>
            {assignments.map(a => {
              const aGrades = grades.filter(g => g.assignment_id === a.id && g.value != null)
              const aAtt = attendance.filter(att => att.assignment_id === a.id)
              const aAvg = aGrades.length > 0 ? (aGrades.reduce((s, g) => s + g.value!, 0) / aGrades.length).toFixed(2) : null
              const aRate = aAtt.length > 0 ? Math.round(aAtt.filter(att => att.is_present).length / aAtt.length * 100) : null
              return (
                <Paper key={a.id} elevation={0} sx={{ p: 2, bgcolor: '#F8FAFC', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>{a.subjectName}</Typography>
                  <Typography variant="caption" color="text.disabled">{a.acad_year} · сем. {a.semester}</Typography>
                  <Box sx={{ display: 'flex', gap: 3, mt: 1.5 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Ср. балл</Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ color: aAvg ? (Number(aAvg) >= 4 ? '#347856' : '#C9874A') : 'text.disabled' }}>{aAvg ?? '—'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Посещ.</Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ color: aRate !== null ? (aRate >= 75 ? '#347856' : '#C9874A') : 'text.disabled' }}>{aRate !== null ? `${aRate}%` : '—'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Оценок</Typography>
                      <Typography variant="body2" fontWeight={700}>{aGrades.length}</Typography>
                    </Box>
                  </Box>
                </Paper>
              )
            })}
          </Box>
        </Section>
      )}

      {/* Grades */}
      <Section title="Оценки" count={grades.length}>
        {grades.length === 0 ? <EmptyRow text="Оценок нет" /> : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Дата</TableCell>
                <TableCell>Предмет</TableCell>
                <TableCell>Тип</TableCell>
                <TableCell align="right">Оценка</TableCell>
                <TableCell>Комментарий</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {grades.map(g => {
                const a = assignments.find(a => a.id === g.assignment_id)
                return (
                  <TableRow key={g.id} hover>
                    <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{String(g.date_recorded).slice(0, 10)}</TableCell>
                    <TableCell>{a?.subjectName ?? '—'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{GRADE_TYPE_LABELS[g.grade_type] ?? g.grade_type}</TableCell>
                    <TableCell align="right">
                      {g.value != null
                        ? <Chip label={g.value} size="small" sx={gradeChip(g.value)} />
                        : g.passed != null
                        ? <Chip label={g.passed ? 'Зачёт' : 'Незачёт'} size="small" sx={g.passed ? { bgcolor: '#D4EDDF', color: '#347856' } : { bgcolor: '#F4D0CC', color: '#D05050' }} />
                        : <Typography variant="body2" color="text.disabled">—</Typography>}
                    </TableCell>
                    <TableCell sx={{ color: 'text.disabled', fontSize: 12 }}>{g.comment ?? ''}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Section>

      {/* Attendance */}
      <Section title="Посещаемость" count={attendance.length}>
        {attendance.length === 0 ? <EmptyRow text="Записей о посещаемости нет" /> : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Дата</TableCell>
                <TableCell>Предмет</TableCell>
                <TableCell align="center">Присутствие</TableCell>
                <TableCell>Комментарий</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {attendance.map(a => {
                const asgn = assignments.find(x => x.id === a.assignment_id)
                return (
                  <TableRow key={a.id} hover sx={{ bgcolor: a.is_present ? 'inherit' : '#FFF5F5' }}>
                    <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{String(a.lesson_date).slice(0, 10)}</TableCell>
                    <TableCell>{asgn?.subjectName ?? '—'}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={a.is_present ? 'Присутствовал' : 'Отсутствовал'}
                        size="small"
                        sx={a.is_present ? { bgcolor: '#D4EDDF', color: '#347856' } : { bgcolor: '#F4D0CC', color: '#D05050' }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'text.disabled', fontSize: 12 }}>{a.comment ?? ''}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Section>

      {/* Tests */}
      <Section title="Тесты" count={Object.keys(sessionsByTest).length}>
        {Object.keys(sessionsByTest).length === 0 ? <EmptyRow text="Тестов нет" /> : (
          <Box>
            {Object.entries(sessionsByTest).map(([testIdStr, testSessions]) => {
              const testId = Number(testIdStr)
              const test = tests[testId]
              return (
                <Box key={testId} sx={{ px: 3, py: 2.5, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
                        {test?.title ?? `Тест #${testId}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                        Попыток: {testSessions.length}
                        {test ? ` / ${test.attempts_allowed} разрешено` : ''}
                        {test ? ` · Проходной балл: ${test.passing_score_pct}%` : ''}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                        {testSessions.map(s => {
                          const sPct = s.score_total != null && s.score_max != null && s.score_max > 0
                            ? Math.round(s.score_total / s.score_max * 100) : null
                          return (
                            <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                              <Typography variant="caption" color="text.disabled" sx={{ width: 80, flexShrink: 0 }}>
                                Попытка {s.attempt_number}
                              </Typography>
                              <StatusBadge status={s.status} passed={s.passed} />
                              {s.status === 'completed' && sPct !== null && (
                                <Typography variant="caption" fontWeight={500}>
                                  {s.score_total?.toFixed(1)} / {s.score_max?.toFixed(1)} ({sPct}%)
                                </Typography>
                              )}
                              <Typography variant="caption" color="text.disabled">
                                {new Date(s.started_at).toLocaleDateString('ru-RU')}
                              </Typography>
                            </Box>
                          )
                        })}
                      </Box>
                    </Box>
                    <Box sx={{ flexShrink: 0, textAlign: 'right' }}>
                      {resetMsg[testId] ? (
                        <Typography variant="caption" sx={{ color: '#347856', display: 'block', maxWidth: 200, textAlign: 'right' }}>{resetMsg[testId]}</Typography>
                      ) : (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleResetTest(testId)}
                          disabled={resetting === testId}
                        >
                          {resetting === testId ? 'Сброс...' : 'Выдать заново'}
                        </Button>
                      )}
                    </Box>
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}
      </Section>
    </Box>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <Paper elevation={2} sx={{ overflow: 'hidden', mb: 3 }}>
      <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>
        {count > 0 && <Typography variant="caption" color="text.disabled">{count}</Typography>}
      </Box>
      {children}
    </Paper>
  )
}

function StatusBadge({ status, passed }: { status: string; passed: boolean | null }) {
  if (status === 'completed') {
    const sx = passed === true ? { bgcolor: '#D4EDDF', color: '#347856' } :
               passed === false ? { bgcolor: '#F4D0CC', color: '#D05050' } :
               { bgcolor: '#F1F5F9', color: '#64748b' }
    return <Chip label={passed === true ? 'Сдал' : passed === false ? 'Не сдал' : 'Завершён'} size="small" sx={sx} />
  }
  if (status === 'in_progress') return <Chip label="В процессе" size="small" sx={{ bgcolor: '#DBEAFE', color: '#1D4ED8' }} />
  return <Chip label={status} size="small" sx={{ bgcolor: '#F1F5F9', color: '#64748b' }} />
}

function EmptyRow({ text }: { text: string }) {
  return <Typography sx={{ px: 3, py: 5, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>{text}</Typography>
}
