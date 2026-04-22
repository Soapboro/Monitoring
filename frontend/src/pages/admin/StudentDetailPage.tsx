import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, Chip, CircularProgress, Breadcrumbs, Link,
  Collapse, Button, LinearProgress, Stack,
} from '@mui/material'
import { ChevronRightRounded, VerifiedRounded, TableChartRounded, PictureAsPdfRounded } from '@mui/icons-material'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import client from '../../api/client'
import type { StudentProfile, GradeOut, AttendanceRecord, TestSession, TeachingAssignment, Subject } from '../../api/resources'
import { useAuthStore } from '../../store/authStore'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import { downloadStudentExcel, downloadStudentPdf } from '../../api/reports'
import { WARM } from '../../theme'

interface SubjectData {
  id: number; name: string
  grades: GradeOut[]; attendance: AttendanceRecord[]
}
interface TeacherSubjectBlock {
  assignment: TeachingAssignment; subject: Subject
  grades: GradeOut[]; attendance: AttendanceRecord[]
}

const GRADE_TYPE_LABELS: Record<string, string> = {
  current: 'Текущая', midterm: 'Промежуточная', final: 'Итоговая',
  test: 'Тест', exam: 'Экзамен', credit: 'Зачёт',
}

const gradeChip = (v: number) =>
  v >= 4 ? { bgcolor: '#D4EDDF', color: '#347856' } :
  v >= 3 ? { bgcolor: '#DBEAFE', color: '#1D4ED8' } :
           { bgcolor: '#F4D0CC', color: '#D05050' }

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore(s => s.user)
  const isTeacher = currentUser?.role === 'teacher'

  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [groupName, setGroupName] = useState('')
  const [subjects, setSubjects] = useState<SubjectData[]>([])
  const [sessions, setSessions] = useState<TestSession[]>([])
  const [expandedSubject, setExpandedSubject] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [teacherBlocks, setTeacherBlocks] = useState<TeacherSubjectBlock[]>([])
  const [exportBusy, setExportBusy] = useState<'excel' | 'pdf' | null>(null)

  useEffect(() => {
    if (!id) return
    async function init() {
      try {
        const [s, gr, att, sess] = await Promise.all([
          client.get<StudentProfile>(`/students/${id}`).then(r => r.data),
          client.get<GradeOut[]>('/grades', { params: { student_id: id } }).then(r => r.data),
          client.get<AttendanceRecord[]>('/attendance', { params: { student_id: id } }).then(r => r.data),
          client.get<TestSession[]>(`/sessions/student/${id}`).then(r => r.data).catch(() => []),
        ])
        setStudent(s); setSessions(sess)

        const gRes = await client.get<{ name: string }>(`/groups/${s.group_id}`)
        setGroupName(gRes.data.name)

        const assignmentIds = [...new Set([...gr.map(g => g.assignment_id), ...att.map(a => a.assignment_id)])]
        const assignToSubject: Record<number, { id: number; name: string }> = {}
        await Promise.all(assignmentIds.map(async (aid) => {
          try {
            const a = await client.get<{ subject_id: number }>(`/teaching-assignments/${aid}`)
            const subj = await client.get<{ id: number; name: string }>(`/subjects/${a.data.subject_id}`)
            assignToSubject[aid] = { id: subj.data.id, name: subj.data.name }
          } catch { assignToSubject[aid] = { id: aid, name: `Предмет #${aid}` } }
        }))

        const subjectMap: Record<number, SubjectData> = {}
        for (const g of gr) {
          const subj = assignToSubject[g.assignment_id]; if (!subj) continue
          if (!subjectMap[subj.id]) subjectMap[subj.id] = { id: subj.id, name: subj.name, grades: [], attendance: [] }
          subjectMap[subj.id].grades.push(g)
        }
        for (const a of att) {
          const subj = assignToSubject[a.assignment_id]; if (!subj) continue
          if (!subjectMap[subj.id]) subjectMap[subj.id] = { id: subj.id, name: subj.name, grades: [], attendance: [] }
          subjectMap[subj.id].attendance.push(a)
        }
        const subjList = Object.values(subjectMap).sort((a, b) => a.name.localeCompare(b.name))
        setSubjects(subjList)
        if (subjList.length > 0) setExpandedSubject(subjList[0].id)

        if (currentUser?.role === 'teacher') {
          try {
            const teacherProfile = await getMyTeacherProfile()
            const teacherAssignments: TeachingAssignment[] = await getAssignments(teacherProfile.id)
            const relevant = teacherAssignments.filter(a => a.group_id === s.group_id)
            if (relevant.length > 0) {
              const subjDetails = await Promise.all(relevant.map(a =>
                client.get<Subject>(`/subjects/${a.subject_id}`).then(r => r.data).catch(() => null)
              ))
              const blocks: TeacherSubjectBlock[] = relevant.map((a, i) => {
                const subj = subjDetails[i]; if (!subj) return null
                return { assignment: a, subject: subj, grades: gr.filter(g => g.assignment_id === a.id), attendance: att.filter(x => x.assignment_id === a.id) }
              }).filter(Boolean) as TeacherSubjectBlock[]
              setTeacherBlocks(blocks)
            }
          } catch { /* silent */ }
        }
      } catch { /* silent */ } finally { setLoading(false) }
    }
    init()
  }, [id, currentUser?.role])

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
  if (!student) return <Typography sx={{ p: 4 }} color="text.secondary">Студент не найден</Typography>

  const fullName = `${student.last_name} ${student.first_name}${student.middle_name ? ' ' + student.middle_name : ''}`
  const allGrades = subjects.flatMap(s => s.grades)
  const allAttendance = subjects.flatMap(s => s.attendance)
  const presentCount = allAttendance.filter(a => a.is_present).length
  const attendanceRate = allAttendance.length > 0 ? Math.round(presentCount / allAttendance.length * 100) : null
  const numericGrades = allGrades.filter(g => g.value !== null)
  const avgGrade = numericGrades.length > 0
    ? (numericGrades.reduce((s, g) => s + (g.value ?? 0), 0) / numericGrades.length).toFixed(2)
    : null
  const passedSessions = sessions.filter(s => s.status === 'completed' && s.passed === true)
  const failedSessions = sessions.filter(s => s.status === 'completed' && s.passed === false)
  const inProgressSessions = sessions.filter(s => s.status !== 'completed')

  return (
    <Box sx={{ p: 4, maxWidth: 900 }}>
      <Breadcrumbs separator={<ChevronRightRounded sx={{ fontSize: 14 }} />} sx={{ mb: 3, fontSize: 13 }}>
        <Link underline="hover" sx={{ cursor: 'pointer' }} color="inherit" onClick={() => navigate('/groups')}>Группы</Link>
        <Link underline="hover" sx={{ cursor: 'pointer' }} color="inherit" onClick={() => navigate(`/groups/${student.group_id}`)}>{groupName}</Link>
        <Typography fontSize={13} color="text.primary" fontWeight={500}>{student.last_name} {student.first_name}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#1D4ED8' }}>{student.last_name[0]}</Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={600}>{fullName}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
              <Link underline="hover" sx={{ cursor: 'pointer', fontSize: 13 }} onClick={() => navigate(`/groups/${student.group_id}`)}>{groupName}</Link>
              {student.student_num && <Typography variant="caption" color="text.secondary">· №{student.student_num}</Typography>}
            </Box>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="outlined" size="small" color="success"
              startIcon={exportBusy === 'excel' ? <CircularProgress size={13} color="inherit" /> : <TableChartRounded fontSize="small" />}
              disabled={exportBusy !== null}
              onClick={async () => {
                setExportBusy('excel')
                try { await downloadStudentExcel(Number(id)) } finally { setExportBusy(null) }
              }}
            >{exportBusy === 'excel' ? 'Формирую...' : 'Excel'}</Button>
            <Button
              variant="outlined" size="small" color="error"
              startIcon={exportBusy === 'pdf' ? <CircularProgress size={13} color="inherit" /> : <PictureAsPdfRounded fontSize="small" />}
              disabled={exportBusy !== null}
              onClick={async () => {
                setExportBusy('pdf')
                try { await downloadStudentPdf(Number(id)) } finally { setExportBusy(null) }
              }}
            >{exportBusy === 'pdf' ? 'Формирую...' : 'PDF'}</Button>
            <Chip
              label={student.is_active ? 'Активен' : 'Неактивен'}
              size="small"
              sx={student.is_active ? { bgcolor: '#D4EDDF', color: '#347856' } : { bgcolor: '#F1F5F9', color: '#64748b' }}
            />
          </Stack>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mt: 2.5, pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
          {[
            { label: 'Средний балл', value: avgGrade ?? '—' },
            { label: 'Оценок', value: numericGrades.length },
            { label: 'Посещаемость', value: attendanceRate !== null ? `${attendanceRate}%` : '—' },
            { label: 'Тестов пройдено', value: `${passedSessions.length} / ${sessions.length}` },
          ].map(s => (
            <Box key={s.label}>
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              <Typography variant="h5" fontWeight={700} sx={{ color: WARM[800] }}>{s.value}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Grades chart — X: date, Y: grade value, one line per subject */}
      {(() => {
        const LINE_COLORS = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6']
        const subjsWithGrades = subjects
          .map(s => ({ name: s.name, grades: s.grades.filter(g => g.value !== null) }))
          .filter(s => s.grades.length > 0)
        if (subjsWithGrades.length === 0) return null

        const allDates = [...new Set(
          subjsWithGrades.flatMap(s => s.grades.map(g => String(g.date_recorded).slice(0, 10)))
        )].sort()
        if (allDates.length < 2) return null

        const chartData = allDates.map(date => {
          const point: Record<string, unknown> = { date }
          subjsWithGrades.forEach(s => {
            const onDate = s.grades.filter(g => String(g.date_recorded).slice(0, 10) === date)
            if (onDate.length > 0) point[s.name] = onDate[onDate.length - 1].value
          })
          return point
        })

        return (
          <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>Оценки по датам</Typography>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={3} stroke="#CBD5E1" strokeDasharray="4 4" />
                {subjsWithGrades.map((s, i) => (
                  <Line key={s.name} type="monotone" dataKey={s.name} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={1.5} dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        )
      })()}

      {/* Teacher block */}
      {isTeacher && teacherBlocks.length > 0 && (
        <Paper elevation={0} sx={{ bgcolor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 3, p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <VerifiedRounded sx={{ fontSize: 18, color: '#1D4ED8' }} />
            <Typography variant="body2" fontWeight={600} sx={{ color: '#1E40AF' }}>Ваши предметы у этого студента</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {teacherBlocks.map(({ assignment, subject, grades, attendance }) => {
              const nums = grades.filter(g => g.value !== null)
              const avg = nums.length > 0 ? (nums.reduce((s, g) => s + (g.value ?? 0), 0) / nums.length).toFixed(1) : null
              const present = attendance.filter(a => a.is_present).length
              const attRate = attendance.length > 0 ? Math.round(present / attendance.length * 100) : null
              const recentGrades = [...grades].sort((a, b) => b.date_recorded.localeCompare(a.date_recorded)).slice(0, 5)

              return (
                <Paper key={assignment.id} elevation={0} sx={{ p: 2, border: '1px solid #BFDBFE', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography variant="body2" fontWeight={500}>{subject.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{assignment.acad_year} · {assignment.semester} сем.</Typography>
                      {assignment.control_form && (
                        <Chip label={assignment.control_form} size="small" sx={{ bgcolor: '#DBEAFE', color: '#1D4ED8', height: 20, fontSize: 11 }} />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button variant="outlined" size="small" sx={{ fontSize: 11 }} onClick={() => navigate(`/assignments/${assignment.id}?tab=grades`)}>Все оценки</Button>
                      <Button variant="outlined" size="small" color="success" sx={{ fontSize: 11 }} onClick={() => navigate(`/assignments/${assignment.id}?tab=attendance`)}>Посещаемость</Button>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                    <Box>
                      <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, display: 'block', mb: 1 }}>Успеваемость</Typography>
                      {grades.length === 0 ? <Typography variant="caption" color="text.disabled">Оценок нет</Typography> : (
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Средний балл:</Typography>
                            {avg !== null ? <Chip label={avg} size="small" sx={gradeChip(Number(avg))} /> : <Typography variant="caption" color="text.disabled">—</Typography>}
                          </Box>
                          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1 }}>{grades.length} оценок всего</Typography>
                          {recentGrades.map(g => (
                            <Box key={g.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25 }}>
                              <Typography variant="caption" color="text.secondary">{String(g.date_recorded).slice(0, 10)} · {GRADE_TYPE_LABELS[g.grade_type] ?? g.grade_type}</Typography>
                              {g.value !== null ? <Chip label={g.value} size="small" sx={{ ...gradeChip(g.value), height: 18, fontSize: 10 }} /> :
                               g.passed !== null ? <Chip label={g.passed ? 'Зачёт' : 'Незачёт'} size="small" sx={{ ...(g.passed ? { bgcolor: '#D4EDDF', color: '#347856' } : { bgcolor: '#F4D0CC', color: '#D05050' }), height: 18, fontSize: 10 }} /> : null}
                            </Box>
                          ))}
                          {grades.length > 5 && (
                            <Typography variant="caption" sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }} onClick={() => navigate(`/assignments/${assignment.id}?tab=grades`)}>
                              Ещё {grades.length - 5} оценок →
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, display: 'block', mb: 1 }}>Посещаемость</Typography>
                      {attendance.length === 0 ? <Typography variant="caption" color="text.disabled">Нет записей</Typography> : (
                        <Box>
                          {attRate !== null && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Процент:</Typography>
                            <Chip label={`${attRate}%`} size="small" sx={attRate >= 75 ? { bgcolor: '#D4EDDF', color: '#347856' } : attRate >= 50 ? { bgcolor: '#FEF3C7', color: '#92400E' } : { bgcolor: '#F4D0CC', color: '#D05050' }} />
                          </Box>}
                          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1 }}>{present} из {attendance.length} занятий</Typography>
                          {attRate !== null && <LinearProgress variant="determinate" value={attRate} sx={{ height: 6, borderRadius: 3, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: attRate >= 75 ? '#347856' : attRate >= 50 ? '#C9874A' : '#D05050', borderRadius: 3 } }} />}
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Paper>
              )
            })}
          </Box>
        </Paper>
      )}

      {/* Subjects accordion */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600}>Предметы</Typography>
          <Typography variant="caption" color="text.disabled">{subjects.length} дисциплин</Typography>
        </Box>

        {subjects.length === 0 ? (
          <Paper sx={{ p: 5, textAlign: 'center' }}><Typography color="text.secondary">Нет данных по предметам</Typography></Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {subjects.map(subj => {
              const present = subj.attendance.filter(a => a.is_present).length
              const rate = subj.attendance.length > 0 ? Math.round(present / subj.attendance.length * 100) : null
              const nums = subj.grades.filter(g => g.value !== null)
              const avg = nums.length > 0 ? (nums.reduce((s, g) => s + (g.value ?? 0), 0) / nums.length).toFixed(1) : null
              const isOpen = expandedSubject === subj.id
              const recentGrades = [...subj.grades].sort((a, b) => b.date_recorded.localeCompare(a.date_recorded)).slice(0, 5)

              return (
                <Paper key={subj.id} elevation={1} sx={{ overflow: 'hidden' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                    onClick={() => setExpandedSubject(isOpen ? null : subj.id)}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <ChevronRightRounded sx={{ fontSize: 16, color: 'text.disabled', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                      <Typography variant="body2" fontWeight={500}>{subj.name}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      {avg !== null && <Chip label={`ср. ${avg}`} size="small" sx={gradeChip(Number(avg))} />}
                      {rate !== null && <Chip label={`${rate}% посещ.`} size="small" sx={rate >= 75 ? { bgcolor: '#D4EDDF', color: '#347856' } : rate >= 50 ? { bgcolor: '#FEF3C7', color: '#92400E' } : { bgcolor: '#F4D0CC', color: '#D05050' }} />}
                      <Typography variant="caption" color="text.disabled">{subj.grades.length} оц. · {subj.attendance.length} зан.</Typography>
                    </Box>
                  </Box>
                  <Collapse in={isOpen} unmountOnExit>
                    <Box sx={{ borderTop: 1, borderColor: 'divider', px: 3, py: 2.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      <Box>
                        <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, display: 'block', mb: 1.5 }}>Посещаемость</Typography>
                        {subj.attendance.length === 0 ? <Typography variant="caption" color="text.disabled">Нет записей</Typography> : (
                          <Box>
                            {[['Всего занятий', subj.attendance.length, 'text.primary'], ['Присутствовал', present, '#347856'], ['Отсутствовал', subj.attendance.length - present, '#D05050']].map(([label, val, color]) => (
                              <Box key={String(label)} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="body2" color="text.secondary">{label}</Typography>
                                <Typography variant="body2" fontWeight={500} sx={{ color }}>{val}</Typography>
                              </Box>
                            ))}
                            {rate !== null && <LinearProgress variant="determinate" value={rate} sx={{ height: 6, borderRadius: 3, mt: 1, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: rate >= 75 ? '#347856' : rate >= 50 ? '#C9874A' : '#D05050', borderRadius: 3 } }} />}
                          </Box>
                        )}
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, display: 'block', mb: 1.5 }}>
                          Последние оценки{subj.grades.length > 5 ? ` (из ${subj.grades.length})` : ''}
                        </Typography>
                        {recentGrades.length === 0 ? <Typography variant="caption" color="text.disabled">Нет оценок</Typography> : (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                            {recentGrades.map(g => (
                              <Box key={g.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="caption" color="text.secondary">{String(g.date_recorded).slice(0, 10)} · {GRADE_TYPE_LABELS[g.grade_type] ?? g.grade_type}</Typography>
                                {g.value !== null ? <Chip label={g.value} size="small" sx={{ ...gradeChip(g.value), height: 20, fontSize: 11 }} /> :
                                 g.passed !== null ? <Chip label={g.passed ? 'Зачёт' : 'Незачёт'} size="small" sx={{ ...(g.passed ? { bgcolor: '#D4EDDF', color: '#347856' } : { bgcolor: '#F4D0CC', color: '#D05050' }), height: 20, fontSize: 11 }} /> :
                                 <Typography variant="caption" color="text.disabled">—</Typography>}
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Collapse>
                </Paper>
              )
            })}
          </Box>
        )}
      </Box>

      {/* Tests */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600}>Тесты</Typography>
          <Typography variant="caption" color="text.disabled">{sessions.length} сессий</Typography>
        </Box>
        {sessions.length === 0 ? (
          <Paper sx={{ p: 5, textAlign: 'center' }}><Typography color="text.secondary">Тестов нет</Typography></Paper>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            {[
              { label: `Пройдено (${passedSessions.length})`, sessions: passedSessions, emptyText: 'Нет пройденных тестов', headerSx: { bgcolor: '#ECFDF5', borderColor: '#A7F3D0' }, dotColor: '#347856', emptyColor: '#D4EDDF' },
              { label: `Не пройдено (${failedSessions.length + inProgressSessions.length})`, sessions: [...failedSessions, ...inProgressSessions], emptyText: 'Все тесты пройдены', headerSx: { bgcolor: '#FEF2F2', borderColor: '#FECACA' }, dotColor: '#D05050', emptyColor: '#F4D0CC' },
            ].map(col => (
              <Paper key={col.label} elevation={1} sx={{ overflow: 'hidden' }}>
                <Box sx={{ ...col.headerSx, px: 2.5, py: 1.5, borderBottom: '1px solid', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: col.dotColor }} />
                  <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 1, color: col.dotColor }}>{col.label}</Typography>
                </Box>
                {col.sessions.length === 0 ? (
                  <Typography sx={{ px: 2.5, py: 3, fontSize: 12, color: 'text.disabled' }}>{col.emptyText}</Typography>
                ) : (
                  <Box>
                    {col.sessions.map(s => {
                      const pct = s.score_max && s.score_max > 0 ? Math.round((s.score_total ?? 0) / s.score_max * 100) : null
                      return (
                        <Box key={s.id} sx={{ px: 2.5, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
                          <Box>
                            <Typography variant="body2">Тест #{s.test_id}</Typography>
                            <Typography variant="caption" color="text.disabled">{s.started_at.slice(0, 10)}</Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            {pct !== null && <Chip label={`${pct}%`} size="small" sx={pct >= 75 ? { bgcolor: '#D4EDDF', color: '#347856' } : pct >= 50 ? { bgcolor: '#DBEAFE', color: '#1D4ED8' } : { bgcolor: '#F4D0CC', color: '#D05050' }} />}
                            {s.status === 'in_progress' && <Chip label="В процессе" size="small" sx={{ bgcolor: '#DBEAFE', color: '#1D4ED8', display: 'block', mt: 0.5 }} />}
                            {s.score_total !== null && s.score_max !== null && (
                              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>{s.score_total}/{s.score_max}</Typography>
                            )}
                          </Box>
                        </Box>
                      )
                    })}
                  </Box>
                )}
              </Paper>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
