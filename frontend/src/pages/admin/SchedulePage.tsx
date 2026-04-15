import { useEffect, useState, useCallback } from 'react'
import type { LessonType, TeachingAssignment, Subject, Group, TeacherProfile } from '../../api/resources'
import {
  getLessons, createLesson, updateLesson, deleteLesson,
  getTeachers, getGroups, getSubjects,
} from '../../api/resources'
import { getAllAssignments } from '../../api/resources'
import type { Lesson } from '../../api/resources'
import {
  Box, Paper, Typography, CircularProgress, Chip,
  Select, MenuItem, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert,
} from '@mui/material'
import {
  ChevronLeftRounded, ChevronRightRounded,
  EditRounded, DeleteOutlineRounded, AddRounded, PlaceRounded,
} from '@mui/icons-material'

// ── Constants ──────────────────────────────────────────────────────────────────

const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  lecture: 'Лекция',
  practice: 'Практика',
  lab: 'Лабораторная',
  seminar: 'Семинар',
  other: 'Другое',
}
const LESSON_TYPE_SX: Record<LessonType, { bgcolor: string; color: string }> = {
  lecture:  { bgcolor: '#DBEAFE', color: '#1D4ED8' },
  practice: { bgcolor: '#D1FAE5', color: '#065F46' },
  lab:      { bgcolor: '#EDE9FE', color: '#6D28D9' },
  seminar:  { bgcolor: '#FEF3C7', color: '#92400E' },
  other:    { bgcolor: '#F1F5F9', color: '#64748b' },
}
const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

// ── Date helpers ───────────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const r = new Date(d)
  r.setDate(d.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function formatDate(d: Date): string { return d.toISOString().slice(0, 10) }
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
function toLocalDT(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [teachers, setTeachers] = useState<TeacherProfile[]>([])
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [teacherFilter, setTeacherFilter] = useState<string>('all')
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editLesson, setEditLesson] = useState<Lesson | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const subjectName = (id: number) => subjects.find(s => s.id === id)?.name ?? '—'
  const groupName = (id: number) => groups.find(g => g.id === id)?.name ?? '—'
  const teacherName = (id: number) => {
    const t = teachers.find(t => t.id === id)
    return t ? `${t.last_name} ${t.first_name[0]}.${t.middle_name ? t.middle_name[0] + '.' : ''}` : '—'
  }
  const assignmentInfo = (aId: number) => assignments.find(a => a.id === aId)

  const loadLessons = useCallback(async () => {
    setLoading(true)
    try {
      const dateFrom = weekStart.toISOString()
      const dateTo = addDays(weekStart, 7).toISOString()
      const params: Record<string, string | undefined> = { date_from: dateFrom, date_to: dateTo }
      if (teacherFilter !== 'all') params.teacher_id = teacherFilter
      const ls = await getLessons(params as Parameters<typeof getLessons>[0])
      setLessons(ls)
    } finally { setLoading(false) }
  }, [weekStart, teacherFilter])

  useEffect(() => {
    Promise.all([getTeachers(), getGroups(), getSubjects(), getAllAssignments()])
      .then(([ts, gs, ss, as]) => { setTeachers(ts); setGroups(gs); setSubjects(ss); setAssignments(as) })
  }, [])

  useEffect(() => { loadLessons() }, [loadLessons])

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const visibleLessons = groupFilter === 'all'
    ? lessons
    : lessons.filter(l => assignmentInfo(l.assignment_id)?.group_id === parseInt(groupFilter))

  const lessonsByDay = (day: Date) => {
    const dateStr = formatDate(day)
    return visibleLessons
      .filter(l => l.starts_at.slice(0, 10) === dateStr)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  }

  const weekLabel = () => {
    const end = addDays(weekStart, 6)
    const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    return `${fmt(weekStart)} — ${fmt(end)}`
  }

  const handleDelete = async () => {
    if (deleteId === null) return
    setDeleting(true)
    try { await deleteLesson(deleteId); setDeleteId(null); loadLessons() }
    finally { setDeleting(false) }
  }

  return (
    <Box sx={{ p: 4, maxWidth: 1300 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Расписание занятий</Typography>
          <Typography variant="body2" color="text.secondary">{weekLabel()} · {visibleLessons.length} занятий</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Select
            size="small" value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)}
            sx={{ minWidth: 180, fontSize: 14 }}
          >
            <MenuItem value="all">Все преподаватели</MenuItem>
            {teachers.map(t => (
              <MenuItem key={t.id} value={String(t.id)}>
                {t.last_name} {t.first_name[0]}.{t.middle_name ? t.middle_name[0] + '.' : ''}
              </MenuItem>
            ))}
          </Select>
          <Select
            size="small" value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
            sx={{ minWidth: 140, fontSize: 14 }}
          >
            <MenuItem value="all">Все группы</MenuItem>
            {groups.filter(g => g.is_active).map(g => (
              <MenuItem key={g.id} value={String(g.id)}>{g.name}</MenuItem>
            ))}
          </Select>

          <IconButton size="small" onClick={() => setWeekStart(w => addDays(w, -7))} sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <ChevronLeftRounded fontSize="small" />
          </IconButton>
          <Button size="small" variant="outlined" onClick={() => setWeekStart(startOfWeek(new Date()))} sx={{ borderColor: 'divider', color: 'text.primary', minWidth: 80 }}>
            Сегодня
          </Button>
          <IconButton size="small" onClick={() => setWeekStart(w => addDays(w, 7))} sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <ChevronRightRounded fontSize="small" />
          </IconButton>

          <Button variant="contained" size="small" startIcon={<AddRounded />} onClick={() => setCreateOpen(true)}>
            Занятие
          </Button>
        </Box>
      </Box>

      {/* Calendar grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1.5 }}>
          {weekDays.map((day, i) => {
            const isToday = formatDate(day) === formatDate(new Date())
            const dayLessons = lessonsByDay(day)
            return (
              <Box key={i} sx={{ minHeight: 192 }}>
                {/* Day header */}
                <Box sx={{ textAlign: 'center', mb: 1.5, pb: 1.5, borderBottom: 2, borderColor: isToday ? '#60A5FA' : 'divider' }}>
                  <Typography variant="caption" fontWeight={500} sx={{ color: isToday ? '#1D4ED8' : 'text.disabled', display: 'block' }}>
                    {WEEKDAY_SHORT[i]}
                  </Typography>
                  <Typography variant="h6" fontWeight={600} sx={{ color: isToday ? '#1D4ED8' : 'text.primary', lineHeight: 1.2 }}>
                    {day.getDate()}
                  </Typography>
                  {dayLessons.length > 0 && (
                    <Typography variant="caption" color="text.disabled">{dayLessons.length} зан.</Typography>
                  )}
                </Box>

                {/* Lessons */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {dayLessons.map(lesson => {
                    const assign = assignmentInfo(lesson.assignment_id)
                    return (
                      <Paper
                        key={lesson.id}
                        elevation={1}
                        sx={{
                          p: 1.25, position: 'relative', overflow: 'hidden',
                          '&:hover .lesson-actions': { opacity: 1 },
                          '&:hover': { boxShadow: 3 },
                          transition: 'box-shadow 0.15s',
                        }}
                      >
                        <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
                          {fmtTime(lesson.starts_at)}–{fmtTime(lesson.ends_at)}
                        </Typography>
                        {assign && (
                          <>
                            <Typography variant="caption" fontWeight={500} sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {subjectName(assign.subject_id)}
                            </Typography>
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {groupName(assign.group_id)}
                            </Typography>
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {teacherName(assign.teacher_id)}
                            </Typography>
                          </>
                        )}
                        {lesson.topic && (
                          <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic', color: 'text.disabled', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25 }}>
                            {lesson.topic}
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.75 }}>
                          <Chip label={LESSON_TYPE_LABELS[lesson.lesson_type]} size="small" sx={{ ...LESSON_TYPE_SX[lesson.lesson_type], height: 18, fontSize: 10, fontWeight: 600 }} />
                          <Box className="lesson-actions" sx={{ display: 'flex', gap: 0.25, opacity: 0, transition: 'opacity 0.15s' }}>
                            <IconButton size="small" sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'primary.main' } }} onClick={() => setEditLesson(lesson)}>
                              <EditRounded sx={{ fontSize: 13 }} />
                            </IconButton>
                            <IconButton size="small" sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'error.main' } }} onClick={() => setDeleteId(lesson.id)}>
                              <DeleteOutlineRounded sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Box>
                        </Box>
                        {lesson.room && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.25 }}>
                            <PlaceRounded sx={{ fontSize: 11, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.disabled">{lesson.room}</Typography>
                          </Box>
                        )}
                      </Paper>
                    )
                  })}
                  {dayLessons.length === 0 && (
                    <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center', pt: 3, display: 'block' }}>—</Typography>
                  )}
                </Box>
              </Box>
            )
          })}
        </Box>
      )}

      {/* Create modal */}
      {createOpen && (
        <LessonFormModal
          teachers={teachers}
          assignments={assignments}
          subjects={subjects}
          groups={groups}
          defaultDate={formatDate(new Date())}
          onClose={() => setCreateOpen(false)}
          onSave={() => { setCreateOpen(false); loadLessons() }}
        />
      )}

      {/* Edit modal */}
      {editLesson && (
        <EditLessonModal
          lesson={editLesson}
          onClose={() => setEditLesson(null)}
          onSave={() => { setEditLesson(null); loadLessons() }}
        />
      )}

      {/* Confirm delete */}
      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Удалить занятие?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Удалить это занятие из расписания? Записи о посещаемости не удалятся.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleteId(null)}>Отмена</Button>
          <Button variant="contained" color="error" disabled={deleting} onClick={handleDelete}>
            {deleting ? 'Удаление...' : 'Удалить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

// ── Create modal ───────────────────────────────────────────────────────────────

function LessonFormModal({ teachers, assignments, subjects, groups, defaultDate, onClose, onSave }: {
  teachers: TeacherProfile[]
  assignments: TeachingAssignment[]
  subjects: Subject[]
  groups: Group[]
  defaultDate: string
  onClose: () => void
  onSave: () => void
}) {
  const [teacherId, setTeacherId] = useState('')
  const [assignmentId, setAssignmentId] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [timeStart, setTimeStart] = useState('08:30')
  const [timeEnd, setTimeEnd] = useState('10:05')
  const [topic, setTopic] = useState('')
  const [lessonType, setLessonType] = useState<LessonType>('lecture')
  const [room, setRoom] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const teacherAssignments = assignments.filter(a => teacherId ? a.teacher_id === parseInt(teacherId) : false)
  const subjectName = (id: number) => subjects.find(s => s.id === id)?.name ?? '—'
  const groupName = (id: number) => groups.find(g => g.id === id)?.name ?? '—'

  const submit = async () => {
    if (!teacherId) { setError('Выберите преподавателя'); return }
    if (!assignmentId) { setError('Выберите дисциплину / группу'); return }
    if (!date) { setError('Укажите дату'); return }
    if (!timeStart || !timeEnd) { setError('Укажите время'); return }
    if (timeEnd <= timeStart) { setError('Время окончания должно быть позже начала'); return }
    setSaving(true); setError('')
    try {
      await createLesson({
        assignment_id: parseInt(assignmentId),
        starts_at: new Date(`${date}T${timeStart}`).toISOString(),
        ends_at: new Date(`${date}T${timeEnd}`).toISOString(),
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
      <DialogTitle>Новое занятие</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            select label="Преподаватель" fullWidth size="small" value={teacherId}
            onChange={e => { setTeacherId(e.target.value); setAssignmentId('') }}
          >
            <MenuItem value=""><em>— выберите —</em></MenuItem>
            {teachers.map(t => (
              <MenuItem key={t.id} value={String(t.id)}>{t.last_name} {t.first_name} {t.middle_name ?? ''}</MenuItem>
            ))}
          </TextField>

          <Box>
            <TextField
              select label="Дисциплина / группа" fullWidth size="small" value={assignmentId}
              onChange={e => setAssignmentId(e.target.value)}
              disabled={!teacherId}
            >
              <MenuItem value=""><em>— выберите —</em></MenuItem>
              {teacherAssignments.map(a => (
                <MenuItem key={a.id} value={String(a.id)}>
                  {subjectName(a.subject_id)} · {groupName(a.group_id)} ({a.acad_year}, сем. {a.semester})
                </MenuItem>
              ))}
            </TextField>
            {teacherId && teacherAssignments.length === 0 && (
              <Typography variant="caption" sx={{ color: '#92400E', mt: 0.5, display: 'block' }}>
                Нет назначений у этого преподавателя
              </Typography>
            )}
          </Box>

          <TextField
            label="Дата" type="date" fullWidth size="small" value={date}
            onChange={e => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField label="Начало" type="time" size="small" value={timeStart}
              onChange={e => setTimeStart(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="Конец" type="time" size="small" value={timeEnd}
              onChange={e => setTimeEnd(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Box>

          <TextField select label="Тип занятия" fullWidth size="small" value={lessonType}
            onChange={e => setLessonType(e.target.value as LessonType)}>
            {(Object.entries(LESSON_TYPE_LABELS) as [LessonType, string][]).map(([v, l]) => (
              <MenuItem key={v} value={v}>{l}</MenuItem>
            ))}
          </TextField>

          <TextField label="Тема (необязательно)" fullWidth size="small" value={topic}
            onChange={e => setTopic(e.target.value)} placeholder="Тема занятия" />

          <TextField label="Аудитория (необязательно)" fullWidth size="small" value={room}
            onChange={e => setRoom(e.target.value)} placeholder="А-205" />

          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>Отмена</Button>
        <Button variant="contained" disabled={saving} onClick={submit}>
          {saving ? 'Создание...' : 'Создать'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Edit modal ─────────────────────────────────────────────────────────────────

function EditLessonModal({ lesson, onClose, onSave }: {
  lesson: Lesson; onClose: () => void; onSave: () => void
}) {
  const [date, setDate] = useState(lesson.starts_at.slice(0, 10))
  const [timeStart, setTimeStart] = useState(toLocalDT(lesson.starts_at).slice(11))
  const [timeEnd, setTimeEnd] = useState(toLocalDT(lesson.ends_at).slice(11))
  const [topic, setTopic] = useState(lesson.topic ?? '')
  const [lessonType, setLessonType] = useState<LessonType>(lesson.lesson_type)
  const [room, setRoom] = useState(lesson.room ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (timeEnd <= timeStart) { setError('Время окончания должно быть позже начала'); return }
    setSaving(true); setError('')
    try {
      await updateLesson(lesson.id, {
        starts_at: new Date(`${date}T${timeStart}`).toISOString(),
        ends_at: new Date(`${date}T${timeEnd}`).toISOString(),
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label="Дата" type="date" fullWidth size="small" value={date}
            onChange={e => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField label="Начало" type="time" size="small" value={timeStart}
              onChange={e => setTimeStart(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="Конец" type="time" size="small" value={timeEnd}
              onChange={e => setTimeEnd(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Box>
          <TextField select label="Тип занятия" fullWidth size="small" value={lessonType}
            onChange={e => setLessonType(e.target.value as LessonType)}>
            {(Object.entries(LESSON_TYPE_LABELS) as [LessonType, string][]).map(([v, l]) => (
              <MenuItem key={v} value={v}>{l}</MenuItem>
            ))}
          </TextField>
          <TextField label="Тема" fullWidth size="small" value={topic} onChange={e => setTopic(e.target.value)} />
          <TextField label="Аудитория" fullWidth size="small" value={room} onChange={e => setRoom(e.target.value)} />
          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>Отмена</Button>
        <Button variant="contained" disabled={saving} onClick={submit}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
