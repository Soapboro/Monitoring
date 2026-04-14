import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, Button, Chip, CircularProgress, Breadcrumbs, Link,
  Table, TableHead, TableBody, TableRow, TableCell, Select, MenuItem,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
} from '@mui/material'
import { ChevronRightRounded } from '@mui/icons-material'
import type { Lesson, LessonType, StudentProfile, AttendanceRecord, GradeRecord } from '../../api/resources'
import { getLesson, updateLesson, bulkAttendance, updateAttendance, createGrade, updateGrade, deleteGrade } from '../../api/resources'
import client from '../../api/client'
import type { Subject, Group, TeachingAssignment } from '../../api/resources'

const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  lecture: 'Лекция', practice: 'Практика', lab: 'Лабораторная', seminar: 'Семинар', other: 'Другое',
}
const LESSON_TYPE_COLORS: Record<LessonType, { bgcolor: string; color: string }> = {
  lecture:  { bgcolor: '#DBEAFE', color: '#1D4ED8' },
  practice: { bgcolor: '#D4EDDF', color: '#347856' },
  lab:      { bgcolor: '#EDE9FE', color: '#6D28D9' },
  seminar:  { bgcolor: '#FEF3C7', color: '#92400E' },
  other:    { bgcolor: '#F1F5F9', color: '#64748b' },
}
const GRADE_TYPE_LABELS: Record<string, string> = {
  current: 'Текущая', thematic: 'Тематическая', midterm: 'Промежуточная',
  final: 'Итоговая', attendance: 'За посещ.',
}

type LessonStatus = 'upcoming' | 'active' | 'past'
function getLessonStatus(lesson: Lesson): LessonStatus {
  const now = new Date()
  if (now > new Date(lesson.ends_at)) return 'past'
  if (now >= new Date(lesson.starts_at)) return 'active'
  return 'upcoming'
}

interface StudentRow {
  student: StudentProfile
  attendance: AttendanceRecord | null
  grade: GradeRecord | null
  isPresent: boolean
  gradeValue: string
  gradeType: string
  gradeComment: string
  dirty: boolean
  gradeDirty: boolean
}

function fmt(iso: string) { return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }
function fmtNice(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

export default function LessonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [assignment, setAssignment] = useState<TeachingAssignment | null>(null)
  const [subject, setSubject] = useState<Subject | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [rows, setRows] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [started, setStarted] = useState(false)

  const lessonDate = lesson ? lesson.starts_at.slice(0, 10) : ''
  const status: LessonStatus = lesson ? getLessonStatus(lesson) : 'upcoming'
  const journalVisible = status !== 'upcoming' || started

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const l = await getLesson(parseInt(id))
      setLesson(l)
      const assign = await client.get<TeachingAssignment>(`/teaching-assignments/${l.assignment_id}`).then(r => r.data)
      setAssignment(assign)
      const [subj, grp, groupStudents, attRecords, gradeRecords] = await Promise.all([
        client.get<Subject>(`/subjects/${assign.subject_id}`).then(r => r.data),
        client.get<Group>(`/groups/${assign.group_id}`).then(r => r.data),
        client.get<StudentProfile[]>('/students', { params: { group_id: assign.group_id } }).then(r => r.data),
        client.get<AttendanceRecord[]>('/attendance', { params: { assignment_id: l.assignment_id } }).then(r => r.data),
        client.get<GradeRecord[]>('/grades', { params: { assignment_id: l.assignment_id } }).then(r => r.data),
      ])
      setSubject(subj); setGroup(grp)
      const date = l.starts_at.slice(0, 10)
      const attByStudent = Object.fromEntries(attRecords.filter(a => a.lesson_date === date).map(a => [a.student_id, a]))
      const gradeByStudent = Object.fromEntries(
        gradeRecords.filter(g => g.date_recorded === date).sort((a, b) => b.id - a.id).map(g => [g.student_id, g])
      )
      setRows(groupStudents.map(s => {
        const att = attByStudent[s.id] ?? null
        const grade = gradeByStudent[s.id] ?? null
        return { student: s, attendance: att, grade, isPresent: att ? att.is_present : true, gradeValue: grade?.value != null ? String(grade.value) : '', gradeType: grade?.grade_type ?? 'current', gradeComment: grade?.comment ?? '', dirty: false, gradeDirty: false }
      }))
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartLesson = () => {
    setRows(prev => prev.map(r => ({ ...r, isPresent: r.attendance ? r.isPresent : true, dirty: r.attendance ? r.dirty : true })))
    setStarted(true)
  }

  const togglePresence = (studentId: number) => {
    setRows(prev => prev.map(r => r.student.id === studentId ? { ...r, isPresent: !r.isPresent, dirty: true } : r))
  }
  const setGradeValue = (studentId: number, val: string) => {
    setRows(prev => prev.map(r => r.student.id === studentId ? { ...r, gradeValue: val, gradeDirty: true } : r))
  }
  const setGradeType = (studentId: number, val: string) => {
    setRows(prev => prev.map(r => r.student.id === studentId ? { ...r, gradeType: val, gradeDirty: true } : r))
  }
  const setGradeComment = (studentId: number, val: string) => {
    setRows(prev => prev.map(r => r.student.id === studentId ? { ...r, gradeComment: val, gradeDirty: true } : r))
  }
  const markAll = (present: boolean) => {
    setRows(prev => prev.map(r => ({ ...r, isPresent: present, dirty: true })))
  }

  const saveAll = async () => {
    if (!lesson || !assignment) return
    setSaving(true)
    try {
      const dirtyAtt = rows.filter(r => r.dirty)
      if (dirtyAtt.length > 0) {
        const existing = dirtyAtt.filter(r => r.attendance !== null)
        const newOnes = dirtyAtt.filter(r => r.attendance === null)
        await Promise.all(existing.map(r => updateAttendance(r.attendance!.id, { is_present: r.isPresent })))
        if (newOnes.length > 0) {
          await bulkAttendance({ assignment_id: assignment.id, lesson_date: lessonDate, records: newOnes.map(r => ({ student_id: r.student.id, is_present: r.isPresent })) })
        }
      }
      const dirtyGrades = rows.filter(r => r.gradeDirty)
      await Promise.all(dirtyGrades.map(async r => {
        const val = r.gradeValue.trim() ? parseFloat(r.gradeValue) : undefined
        const hasData = r.gradeValue.trim() || r.gradeComment.trim()
        if (r.grade) {
          if (!hasData) { await deleteGrade(r.grade.id) }
          else { await updateGrade(r.grade.id, { value: val, comment: r.gradeComment.trim() || undefined }) }
        } else if (hasData) {
          await createGrade({ student_id: r.student.id, assignment_id: assignment.id, grade_type: r.gradeType, value: val, comment: r.gradeComment.trim() || undefined, date_recorded: lessonDate })
        }
      }))
      setSavedMsg('Сохранено')
      setTimeout(() => setSavedMsg(''), 2500)
      await load()
    } finally { setSaving(false) }
  }

  const hasDirty = rows.some(r => r.dirty || r.gradeDirty)

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
  if (!lesson) return <Typography sx={{ p: 4 }} color="text.secondary">Занятие не найдено</Typography>

  const dateStr = new Date(lesson.starts_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
  const timeStr = `${fmt(lesson.starts_at)}–${fmt(lesson.ends_at)}`
  const presentCount = rows.filter(r => r.isPresent).length

  const statusBorderColor = status === 'active' ? '#34D399' : status === 'past' ? 'divider' : '#BFDBFE'

  return (
    <Box sx={{ p: 4, maxWidth: 900 }}>
      {/* Breadcrumb */}
      <Breadcrumbs separator={<ChevronRightRounded sx={{ fontSize: 14 }} />} sx={{ mb: 3, fontSize: 13 }}>
        <Link underline="hover" sx={{ cursor: 'pointer' }} color="inherit" onClick={() => navigate('/lessons')}>Занятия</Link>
        <Typography fontSize={13} color="text.primary" fontWeight={500}>
          {new Date(lesson.starts_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
        </Typography>
      </Breadcrumbs>

      {/* Lesson info card */}
      <Paper elevation={1} sx={{ p: 3, mb: 3, border: '1px solid', borderColor: statusBorderColor }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5, alignItems: 'center' }}>
              <Chip label={LESSON_TYPE_LABELS[lesson.lesson_type]} size="small" sx={LESSON_TYPE_COLORS[lesson.lesson_type]} />
              <Typography variant="body2" color="text.secondary">{timeStr}</Typography>
              {lesson.room && <Typography variant="body2" color="text.disabled">· 📍 {lesson.room}</Typography>}
              {status === 'active' && <Chip label="Идёт сейчас" size="small" sx={{ bgcolor: '#D4EDDF', color: '#347856' }} />}
              {status === 'upcoming' && !started && <Chip label="Предстоящее" size="small" sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }} />}
              {status === 'upcoming' && started && <Chip label="Начато досрочно" size="small" sx={{ bgcolor: '#ECFDF5', color: '#347856', border: '1px solid #A7F3D0' }} />}
              {status === 'past' && <Chip label="Прошедшее" size="small" sx={{ bgcolor: '#F1F5F9', color: '#64748b' }} />}
            </Box>
            <Typography variant="h6" fontWeight={600}>{subject?.name ?? '—'}</Typography>
            {lesson.topic && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{lesson.topic}</Typography>}
            <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5, textTransform: 'capitalize' }}>
              {group?.name ?? '—'} · {dateStr}
            </Typography>
          </Box>
          <Button variant="outlined" size="small" onClick={() => setEditOpen(true)}>Редактировать</Button>
        </Box>

        {journalVisible && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mt: 2.5, pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
            <Box><Typography variant="caption" color="text.secondary">Студентов</Typography><Typography variant="h5" fontWeight={700}>{rows.length}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Присутствуют</Typography><Typography variant="h5" fontWeight={700} sx={{ color: '#347856' }}>{presentCount}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Отсутствуют</Typography><Typography variant="h5" fontWeight={700} sx={{ color: '#D05050' }}>{rows.length - presentCount}</Typography></Box>
          </Box>
        )}
      </Paper>

      {/* Start lesson CTA */}
      {status === 'upcoming' && !started && (
        <Paper elevation={0} sx={{ bgcolor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 3, p: 3, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography fontWeight={600} sx={{ color: '#1E40AF', mb: 0.5 }}>Занятие ещё не началось</Typography>
            <Typography variant="body2" sx={{ color: '#3B82F6' }}>
              Запланировано на {fmtNice(lesson.starts_at)}. Нажмите «Начать занятие», чтобы открыть журнал.
            </Typography>
          </Box>
          <Button variant="contained" onClick={handleStartLesson} sx={{ flexShrink: 0 }}>Начать занятие</Button>
        </Paper>
      )}

      {/* Journal */}
      {journalVisible && (
        <>
          {/* Toolbar */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>Журнал занятия</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Typography
                variant="caption"
                sx={{ color: '#347856', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                onClick={() => markAll(true)}
              >
                Все присутствуют
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: '#D05050', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                onClick={() => markAll(false)}
              >
                Все отсутствуют
              </Typography>
              {savedMsg && <Typography variant="caption" sx={{ color: '#347856', fontWeight: 600 }}>{savedMsg}</Typography>}
              <Button
                variant="contained"
                size="small"
                onClick={saveAll}
                disabled={saving || !hasDirty}
              >
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>
            </Box>
          </Box>

          {rows.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">В группе нет студентов</Typography>
            </Paper>
          ) : (
            <Paper elevation={2} sx={{ overflow: 'hidden' }}>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 40 }}>#</TableCell>
                      <TableCell>Студент</TableCell>
                      <TableCell align="center" sx={{ width: 110 }}>Присутствие</TableCell>
                      <TableCell sx={{ width: 130 }}>Тип оценки</TableCell>
                      <TableCell align="center" sx={{ width: 90 }}>Оценка</TableCell>
                      <TableCell>Комментарий</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row, i) => (
                      <TableRow
                        key={row.student.id}
                        sx={{ bgcolor: (row.dirty || row.gradeDirty) ? 'action.selected' : 'inherit' }}
                      >
                        <TableCell sx={{ color: 'text.disabled', fontSize: 12 }}>{i + 1}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{
                              width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              bgcolor: row.isPresent ? '#D4EDDF' : '#F4D0CC',
                            }}>
                              <Typography variant="caption" fontWeight={700} sx={{ color: row.isPresent ? '#347856' : '#D05050' }}>
                                {row.student.last_name[0]}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="body2" fontWeight={500}>
                                {row.student.last_name} {row.student.first_name}{row.student.middle_name ? ` ${row.student.middle_name}` : ''}
                              </Typography>
                              {row.student.student_num && (
                                <Typography variant="caption" color="text.disabled">{row.student.student_num}</Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Box
                            onClick={() => togglePresence(row.student.id)}
                            sx={{
                              width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              mx: 'auto', cursor: 'pointer', fontWeight: 700, fontSize: 16,
                              bgcolor: row.isPresent ? '#D4EDDF' : '#F4D0CC',
                              color: row.isPresent ? '#347856' : '#D05050',
                              '&:hover': { opacity: 0.8 },
                            }}
                          >
                            {row.isPresent ? '✓' : '✗'}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Select
                            size="small"
                            value={row.gradeType}
                            onChange={e => setGradeType(row.student.id, e.target.value)}
                            sx={{ fontSize: 12, width: '100%' }}
                          >
                            {Object.entries(GRADE_TYPE_LABELS).map(([v, l]) => (
                              <MenuItem key={v} value={v} sx={{ fontSize: 12 }}>{l}</MenuItem>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            type="number"
                            size="small"
                            inputProps={{ min: 1, max: 5, step: 0.5, style: { textAlign: 'center', fontSize: 13 } }}
                            value={row.gradeValue}
                            onChange={e => setGradeValue(row.student.id, e.target.value)}
                            placeholder="—"
                            sx={{ width: 70 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            value={row.gradeComment}
                            onChange={e => setGradeComment(row.student.id, e.target.value)}
                            placeholder="—"
                            inputProps={{ style: { fontSize: 13 } }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>

              {hasDirty && (
                <Box sx={{ px: 3, py: 1.5, bgcolor: '#EFF6FF', borderTop: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: '#1D4ED8' }}>Есть несохранённые изменения</Typography>
                  <Button variant="contained" size="small" onClick={saveAll} disabled={saving}>
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                </Box>
              )}
            </Paper>
          )}
        </>
      )}

      {/* Edit modal */}
      {editOpen && lesson && (
        <EditLessonModal lesson={lesson} onClose={() => setEditOpen(false)} onSave={() => { setEditOpen(false); load() }} />
      )}
    </Box>
  )
}

function EditLessonModal({ lesson, onClose, onSave }: { lesson: Lesson; onClose: () => void; onSave: () => void }) {
  const toLocal = (iso: string) => {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const [startsAt, setStartsAt] = useState(toLocal(lesson.starts_at))
  const [endsAt, setEndsAt] = useState(toLocal(lesson.ends_at))
  const [topic, setTopic] = useState(lesson.topic ?? '')
  const [lessonType, setLessonType] = useState<LessonType>(lesson.lesson_type)
  const [room, setRoom] = useState(lesson.room ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (endsAt <= startsAt) { setError('Время окончания должно быть позже начала'); return }
    setSaving(true); setError('')
    try {
      await updateLesson(lesson.id, {
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        topic: topic.trim() || undefined,
        lesson_type: lessonType,
        room: room.trim() || undefined,
      })
      onSave()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Ошибка сохранения')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Редактировать занятие</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
          <TextField label="Начало" type="datetime-local" fullWidth size="small" value={startsAt} onChange={e => setStartsAt(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Конец" type="datetime-local" fullWidth size="small" value={endsAt} onChange={e => setEndsAt(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Box>
        <Box sx={{ mt: 2 }}>
          <TextField select label="Тип занятия" fullWidth size="small" value={lessonType} onChange={e => setLessonType(e.target.value as LessonType)}>
            {(Object.entries(LESSON_TYPE_LABELS) as [LessonType, string][]).map(([v, l]) => (
              <MenuItem key={v} value={v}>{l}</MenuItem>
            ))}
          </TextField>
        </Box>
        <TextField label="Тема" fullWidth size="small" sx={{ mt: 2 }} value={topic} onChange={e => setTopic(e.target.value)} />
        <TextField label="Аудитория" fullWidth size="small" sx={{ mt: 2 }} value={room} onChange={e => setRoom(e.target.value)} />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Отмена</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
