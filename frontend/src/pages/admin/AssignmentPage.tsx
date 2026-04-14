import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box, Paper, Typography, Chip, CircularProgress, Breadcrumbs, Link,
  Table, TableHead, TableBody, TableRow, TableCell, Collapse,
  Tab, Tabs, Select, MenuItem, Button,
} from '@mui/material'
import { ChevronRightRounded, ExpandMoreRounded, ChevronRightRounded as ChevronExpandIcon } from '@mui/icons-material'
import client from '../../api/client'
import type { TeachingAssignment, Subject, StudentProfile, GradeOut, AttendanceRecord, TeacherProfile } from '../../api/resources'
import { updateAssignment } from '../../api/resources'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'
import { WARM } from '../../theme'

const CONTROL_FORMS = ['Экзамен', 'Зачёт', 'Дифференцированный зачёт', 'Контрольная работа', 'Курсовая работа', 'Реферат']

type Tab_ = 'grades' | 'attendance'

interface DateRow {
  date: string
  total: number
  present: number
  records: AttendanceRecord[]
}

const GRADE_TYPE_LABELS: Record<string, string> = {
  current: 'Текущая', midterm: 'Промежуточная', final: 'Итоговая',
  test: 'Тест', exam: 'Экзамен', credit: 'Зачёт',
}

const gradeChip = (v: number) =>
  v >= 4 ? { bgcolor: '#D4EDDF', color: '#347856' } :
  v >= 3 ? { bgcolor: '#DBEAFE', color: '#1D4ED8' } :
           { bgcolor: '#F4D0CC', color: '#D05050' }

export default function AssignmentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [assignment, setAssignment] = useState<TeachingAssignment | null>(null)
  const [subject, setSubject] = useState<Subject | null>(null)
  const [groupName, setGroupName] = useState('')
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null)
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [grades, setGrades] = useState<GradeOut[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const initialTab = searchParams.get('tab') === 'attendance' ? 1 : 0
  const [tabIdx, setTabIdx] = useState(initialTab)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [expandedStudent, setExpandedStudent] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [editControlForm, setEditControlForm] = useState(false)
  const [controlFormValue, setControlFormValue] = useState('')
  const [savingCF, setSavingCF] = useState(false)

  useEffect(() => {
    if (!id) return
    async function init() {
      try {
        const a = await client.get<TeachingAssignment>(`/teaching-assignments/${id}`).then(r => r.data)
        setAssignment(a)
        setControlFormValue(a.control_form ?? '')

        const [subj, grp, t, studs, gr, att] = await Promise.all([
          client.get<Subject>(`/subjects/${a.subject_id}`).then(r => r.data).catch(() => null),
          client.get<{ name: string }>(`/groups/${a.group_id}`).then(r => r.data).catch(() => null),
          client.get<TeacherProfile>(`/teachers/${a.teacher_id}`).then(r => r.data).catch(() => null),
          client.get<StudentProfile[]>('/students', { params: { group_id: a.group_id } }).then(r => r.data).catch(() => []),
          client.get<GradeOut[]>('/grades', { params: { assignment_id: id } }).then(r => r.data).catch(() => []),
          client.get<AttendanceRecord[]>('/attendance', { params: { assignment_id: id } }).then(r => r.data).catch(() => []),
        ])

        setSubject(subj)
        setGroupName(grp?.name ?? '')
        setTeacher(t)
        setStudents(studs)
        setGrades(gr)
        setAttendance(att)
      } catch { /* silent */ } finally { setLoading(false) }
    }
    init()
  }, [id])

  const studentMap: Record<number, StudentProfile> = {}
  for (const s of students) studentMap[s.id] = s

  const byDate: Record<string, AttendanceRecord[]> = {}
  for (const r of attendance) {
    const d = String(r.lesson_date).slice(0, 10)
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(r)
  }
  const dateRows: DateRow[] = Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, records]) => ({ date, total: records.length, present: records.filter(r => r.is_present).length, records }))

  const gradesByStudent: Record<number, GradeOut[]> = {}
  for (const g of grades) {
    if (!gradesByStudent[g.student_id]) gradesByStudent[g.student_id] = []
    gradesByStudent[g.student_id].push(g)
  }
  const studentGradeRows = Object.entries(gradesByStudent).map(([sid, sGrades]) => ({ sid: Number(sid), sGrades }))

  const { sorted: sortedStudents, sortKey: gradesSortKey, sortDir: gradesSortDir, toggleSort: gradesToggleSort } = useSort(studentGradeRows, (row, key) => {
    const s = studentMap[row.sid]
    if (key === 'student') return s ? `${s.last_name} ${s.first_name}` : `Студент #${row.sid}`
    if (key === 'count') return row.sGrades.length
    if (key === 'avg') {
      const nums = row.sGrades.filter(g => g.value !== null)
      return nums.length > 0 ? nums.reduce((s, g) => s + (g.value ?? 0), 0) / nums.length : -1
    }
    return ''
  })

  const { sorted: sortedDates, sortKey: attSortKey, sortDir: attSortDir, toggleSort: attToggleSort } = useSort(dateRows, (row, key) => {
    if (key === 'date') return row.date
    if (key === 'total') return row.total
    if (key === 'present') return row.present
    if (key === 'rate') return row.total > 0 ? Math.round(row.present / row.total * 100) : -1
    return ''
  })

  if (loading) return <Spin />
  if (!assignment) return <Typography sx={{ p: 4 }} color="text.secondary">Назначение не найдено</Typography>

  const teacherName = teacher ? `${teacher.last_name} ${teacher.first_name}` : ''
  const totalPresent = attendance.filter(r => r.is_present).length
  const attendanceRate = attendance.length > 0 ? Math.round(totalPresent / attendance.length * 100) : null
  const numericGrades = grades.filter(g => g.value !== null)
  const avgGrade = numericGrades.length > 0
    ? (numericGrades.reduce((s, g) => s + (g.value ?? 0), 0) / numericGrades.length).toFixed(2)
    : null

  return (
    <Box sx={{ p: 4, maxWidth: 900 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs separator={<ChevronRightRounded sx={{ fontSize: 14 }} />} sx={{ mb: 3, fontSize: 13 }}>
        <Link underline="hover" sx={{ cursor: 'pointer' }} color="inherit" onClick={() => navigate('/teachers')}>Преподаватели</Link>
        {teacher && (
          <Link underline="hover" sx={{ cursor: 'pointer' }} color="inherit" onClick={() => navigate(`/teachers/${assignment.teacher_id}`)}>
            {teacherName}
          </Link>
        )}
        <Link underline="hover" sx={{ cursor: 'pointer' }} color="inherit" onClick={() => navigate(`/groups/${assignment.group_id}`)}>
          {groupName}
        </Link>
        <Typography fontSize={13} color="text.primary" fontWeight={500}>{subject?.name ?? `Предмет #${assignment.subject_id}`}</Typography>
      </Breadcrumbs>

      {/* Header card */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={600}>{subject?.name}</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mt: 1, mb: 0 }}>
          <Link underline="hover" sx={{ cursor: 'pointer', fontSize: 13 }} onClick={() => navigate(`/groups/${assignment.group_id}`)}>
            {groupName}
          </Link>
          {teacher && (
            <>
              <Typography variant="caption" color="text.disabled">·</Typography>
              <Link underline="hover" sx={{ cursor: 'pointer', fontSize: 13 }} onClick={() => navigate(`/teachers/${assignment.teacher_id}`)}>
                {teacherName}
              </Link>
            </>
          )}
          <Typography variant="caption" color="text.secondary">· {assignment.acad_year}, сем. {assignment.semester}</Typography>

          {editControlForm ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.disabled">·</Typography>
              <Select
                size="small"
                value={controlFormValue}
                onChange={e => setControlFormValue(e.target.value)}
                displayEmpty
                sx={{ fontSize: 12, height: 26 }}
              >
                <MenuItem value=""><em>— не указана —</em></MenuItem>
                {CONTROL_FORMS.map(f => <MenuItem key={f} value={f} sx={{ fontSize: 12 }}>{f}</MenuItem>)}
              </Select>
              <Button size="small" variant="text" disabled={savingCF} onClick={async () => {
                setSavingCF(true)
                const updated = await updateAssignment(assignment.id, { control_form: controlFormValue || null })
                setAssignment(updated)
                setEditControlForm(false)
                setSavingCF(false)
              }}>Сохранить</Button>
              <Button size="small" variant="text" color="inherit" onClick={() => setEditControlForm(false)}>Отмена</Button>
            </Box>
          ) : (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
              onClick={() => setEditControlForm(true)}
            >
              · {assignment.control_form ?? <Box component="span" sx={{ color: 'text.disabled' }}>форма контроля не указана</Box>}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mt: 2.5, pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
          {[
            { label: 'Студентов', value: students.length },
            { label: 'Оценок', value: grades.length },
            { label: 'Средний балл', value: avgGrade ?? '—' },
            { label: 'Посещаемость', value: attendanceRate !== null ? `${attendanceRate}%` : '—' },
          ].map(s => (
            <Box key={s.label}>
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              <Typography variant="h5" fontWeight={700} sx={{ color: WARM[800] }}>{s.value}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Tabs */}
      <Tabs value={tabIdx} onChange={(_, v) => setTabIdx(v)} sx={{ mb: 2 }}>
        <Tab label={`Оценки${grades.length > 0 ? ` (${grades.length})` : ''}`} />
        <Tab label={`Посещаемость${attendance.length > 0 ? ` (${attendance.length})` : ''}`} />
      </Tabs>

      {/* Grades tab */}
      {tabIdx === 0 && (
        grades.length === 0 ? <Empty text="Оценок нет" /> : (
          <Paper elevation={2} sx={{ overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <SortableHeader label="Студент" sortKey="student" currentKey={gradesSortKey} dir={gradesSortDir} onSort={gradesToggleSort} />
                  <SortableHeader label="Оценок" sortKey="count" currentKey={gradesSortKey} dir={gradesSortDir} onSort={gradesToggleSort} align="right" />
                  <SortableHeader label="Ср. балл" sortKey="avg" currentKey={gradesSortKey} dir={gradesSortDir} onSort={gradesToggleSort} align="right" />
                  <TableCell sx={{ width: 40 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedStudents.map(({ sid, sGrades }) => {
                  const student = studentMap[sid]
                  const nums = sGrades.filter(g => g.value !== null)
                  const avg = nums.length > 0
                    ? (nums.reduce((s, g) => s + (g.value ?? 0), 0) / nums.length).toFixed(2)
                    : null
                  const isOpen = expandedStudent === sid
                  return (
                    <>
                      <TableRow
                        key={sid}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => setExpandedStudent(isOpen ? null : sid)}
                      >
                        <TableCell>
                          <Box
                            component="span"
                            sx={{ fontWeight: 500, '&:hover': { color: 'primary.main', textDecoration: 'underline' }, cursor: 'pointer' }}
                            onClick={e => { e.stopPropagation(); navigate(`/students/${sid}`) }}
                          >
                            {student ? `${student.last_name} ${student.first_name}${student.middle_name ? ' ' + student.middle_name : ''}` : `Студент #${sid}`}
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary' }}>{sGrades.length}</TableCell>
                        <TableCell align="right">
                          {avg !== null
                            ? <Chip label={avg} size="small" sx={gradeChip(Number(avg))} />
                            : <Typography variant="body2" color="text.disabled">—</Typography>}
                        </TableCell>
                        <TableCell align="right" sx={{ pr: 2 }}>
                          <ChevronExpandIcon sx={{ fontSize: 16, color: 'text.disabled', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                        </TableCell>
                      </TableRow>
                      <TableRow key={`${sid}-detail`}>
                        <TableCell colSpan={4} sx={{ p: 0, border: 0 }}>
                          <Collapse in={isOpen} unmountOnExit>
                            <Box sx={{ px: 4, py: 2, bgcolor: 'action.hover' }}>
                              {[...sGrades].sort((a, b) => b.date_recorded.localeCompare(a.date_recorded)).map(g => (
                                <Box key={g.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    {String(g.date_recorded).slice(0, 10)} · {GRADE_TYPE_LABELS[g.grade_type] ?? g.grade_type}
                                    {g.comment ? ` · ${g.comment}` : ''}
                                  </Typography>
                                  {g.value !== null
                                    ? <Chip label={g.value} size="small" sx={gradeChip(g.value)} />
                                    : g.passed !== null
                                    ? <Chip label={g.passed ? 'Зачёт' : 'Незачёт'} size="small" sx={g.passed ? { bgcolor: '#D4EDDF', color: '#347856' } : { bgcolor: '#F4D0CC', color: '#D05050' }} />
                                    : <Typography variant="body2" color="text.disabled">—</Typography>}
                                </Box>
                              ))}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </>
                  )
                })}
              </TableBody>
            </Table>
          </Paper>
        )
      )}

      {/* Attendance tab */}
      {tabIdx === 1 && (
        attendance.length === 0 ? <Empty text="Записей нет" /> : (
          <Paper elevation={2} sx={{ overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <SortableHeader label="Дата" sortKey="date" currentKey={attSortKey} dir={attSortDir} onSort={attToggleSort} />
                  <SortableHeader label="Всего" sortKey="total" currentKey={attSortKey} dir={attSortDir} onSort={attToggleSort} align="right" />
                  <SortableHeader label="Присутствовало" sortKey="present" currentKey={attSortKey} dir={attSortDir} onSort={attToggleSort} align="right" />
                  <SortableHeader label="%" sortKey="rate" currentKey={attSortKey} dir={attSortDir} onSort={attToggleSort} align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedDates.map(row => {
                  const rate = Math.round(row.present / row.total * 100)
                  const isOpen = expandedDate === row.date
                  const rateSx = rate >= 75 ? { bgcolor: '#D4EDDF', color: '#347856' } :
                                 rate >= 50 ? { bgcolor: '#FFF3CD', color: '#856404' } :
                                              { bgcolor: '#F4D0CC', color: '#D05050' }
                  return (
                    <>
                      <TableRow
                        key={row.date}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => setExpandedDate(isOpen ? null : row.date)}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ChevronExpandIcon sx={{ fontSize: 14, color: 'text.disabled', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                            <Typography variant="body2" fontWeight={500}>{row.date}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary' }}>{row.total}</TableCell>
                        <TableCell align="right" sx={{ color: '#347856', fontWeight: 500 }}>{row.present}</TableCell>
                        <TableCell align="right"><Chip label={`${rate}%`} size="small" sx={rateSx} /></TableCell>
                      </TableRow>
                      <TableRow key={`${row.date}-detail`}>
                        <TableCell colSpan={4} sx={{ p: 0, border: 0 }}>
                          <Collapse in={isOpen} unmountOnExit>
                            <Box sx={{ px: 4, py: 2, bgcolor: '#f8fafc' }}>
                              {row.records.filter(r => r.is_present).length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                  <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, display: 'block', mb: 1 }}>
                                    Присутствовали ({row.records.filter(r => r.is_present).length})
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {row.records.filter(r => r.is_present).map(r => {
                                      const s = studentMap[r.student_id]
                                      return (
                                        <Chip
                                          key={r.id}
                                          label={s ? `${s.last_name} ${s.first_name}` : `#${r.student_id}`}
                                          size="small"
                                          onClick={e => { e.stopPropagation(); navigate(`/students/${r.student_id}`) }}
                                          sx={{ bgcolor: '#D4EDDF', color: '#347856', cursor: 'pointer' }}
                                        />
                                      )
                                    })}
                                  </Box>
                                </Box>
                              )}
                              {row.records.filter(r => !r.is_present).length > 0 && (
                                <Box>
                                  <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, display: 'block', mb: 1 }}>
                                    Отсутствовали ({row.records.filter(r => !r.is_present).length})
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                    {row.records.filter(r => !r.is_present).map(r => {
                                      const s = studentMap[r.student_id]
                                      return (
                                        <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                          <Chip
                                            label={s ? `${s.last_name} ${s.first_name}` : `#${r.student_id}`}
                                            size="small"
                                            onClick={e => { e.stopPropagation(); navigate(`/students/${r.student_id}`) }}
                                            sx={{ bgcolor: '#F4D0CC', color: '#D05050', cursor: 'pointer' }}
                                          />
                                          {r.comment && <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>Причина: {r.comment}</Typography>}
                                        </Box>
                                      )
                                    })}
                                  </Box>
                                </Box>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </>
                  )
                })}
              </TableBody>
            </Table>
          </Paper>
        )
      )}
    </Box>
  )
}

const Spin = () => <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
const Empty = ({ text }: { text: string }) => (
  <Paper sx={{ p: 6, textAlign: 'center' }}><Typography color="text.secondary">{text}</Typography></Paper>
)
