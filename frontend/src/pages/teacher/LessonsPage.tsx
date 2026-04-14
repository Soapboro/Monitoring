import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, Button, Chip, CircularProgress,
} from '@mui/material'
import { ChevronLeftRounded, ChevronRightRounded, FiberManualRecordRounded, PlaceRounded } from '@mui/icons-material'
import type { Lesson, LessonType } from '../../api/resources'
import { getLessons, getAssignments, getMyTeacherProfile } from '../../api/resources'
import type { TeachingAssignment } from '../../api/resources'
import client from '../../api/client'
import type { Subject, Group } from '../../api/resources'

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
const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

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

type LessonStatus = 'past' | 'active' | 'upcoming'
function lessonStatus(lesson: Lesson): LessonStatus {
  const now = new Date()
  if (now > new Date(lesson.ends_at)) return 'past'
  if (now >= new Date(lesson.starts_at)) return 'active'
  return 'upcoming'
}

export default function LessonsPage() {
  const navigate = useNavigate()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const profile = await getMyTeacherProfile()
      const dateFrom = weekStart.toISOString()
      const dateTo = addDays(weekStart, 7).toISOString()
      const [ls, assigns, subjs, grps] = await Promise.all([
        getLessons({ date_from: dateFrom, date_to: dateTo }),
        getAssignments(profile.id),
        client.get<Subject[]>('/subjects').then(r => r.data),
        client.get<Group[]>('/groups').then(r => r.data),
      ])
      setLessons(ls); setAssignments(assigns); setSubjects(subjs); setGroups(grps)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  const subjectName = (id: number) => subjects.find(s => s.id === id)?.name ?? '—'
  const groupName   = (id: number) => groups.find(g => g.id === id)?.name ?? '—'
  const weekDays    = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const lessonsByDay = (day: Date) => {
    const dateStr = formatDate(day)
    return lessons.filter(l => l.starts_at.slice(0, 10) === dateStr).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  }
  const weekLabel = () => {
    const end = addDays(weekStart, 6)
    const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    return `${fmt(weekStart)} — ${fmt(end)}`
  }

  const todayStr = formatDate(new Date())
  const todayLessons = lessons.filter(l => l.starts_at.slice(0, 10) === todayStr).sort((a, b) => a.starts_at.localeCompare(b.starts_at))

  return (
    <Box sx={{ p: 4, maxWidth: 1100 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Мои занятия</Typography>
          <Typography variant="body2" color="text.secondary">{weekLabel()}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button variant="outlined" size="small" sx={{ minWidth: 0, px: 1 }} onClick={() => setWeekStart(w => addDays(w, -7))}>
            <ChevronLeftRounded />
          </Button>
          <Button variant="outlined" size="small" onClick={() => setWeekStart(startOfWeek(new Date()))}>Сегодня</Button>
          <Button variant="outlined" size="small" sx={{ minWidth: 0, px: 1 }} onClick={() => setWeekStart(w => addDays(w, 7))}>
            <ChevronRightRounded />
          </Button>
        </Box>
      </Box>

      {/* Today's lessons banner */}
      {!loading && todayLessons.length > 0 && (
        <Paper elevation={0} sx={{ bgcolor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 3, p: 2.5, mb: 3 }}>
          <Typography variant="body2" fontWeight={600} sx={{ color: '#1D4ED8', mb: 1.5 }}>
            Сегодня · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {todayLessons.map(lesson => {
              const assign = assignments.find(a => a.id === lesson.assignment_id)
              const status = lessonStatus(lesson)
              return (
                <Paper
                  key={lesson.id}
                  elevation={status === 'active' ? 2 : 1}
                  onClick={() => navigate(`/lessons/${lesson.id}`)}
                  sx={{
                    px: 2.5, py: 1.5, cursor: 'pointer', borderRadius: 2,
                    bgcolor: status === 'active' ? '#347856' : 'background.paper',
                    color: status === 'active' ? 'white' : 'text.primary',
                    border: status === 'upcoming' ? '1px solid #BFDBFE' : 'none',
                    '&:hover': { boxShadow: 4 },
                  }}
                >
                  <Typography variant="caption" sx={{ opacity: 0.7, display: 'block' }}>
                    {fmtTime(lesson.starts_at)}–{fmtTime(lesson.ends_at)}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {assign ? subjectName(assign.subject_id) : '—'}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    {assign ? groupName(assign.group_id) : ''}
                    {lesson.room ? ` · ${lesson.room}` : ''}
                  </Typography>
                  {status === 'active' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                      <FiberManualRecordRounded sx={{ fontSize: 8 }} />
                      <Typography variant="caption" fontWeight={600}>Идёт сейчас</Typography>
                    </Box>
                  )}
                  {status === 'upcoming' && (
                    <Typography variant="caption" sx={{ color: '#1D4ED8', display: 'block', mt: 0.5 }}>Открыть журнал →</Typography>
                  )}
                </Paper>
              )
            })}
          </Box>
        </Paper>
      )}

      {/* Weekly calendar grid */}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box> : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1.5 }}>
          {weekDays.map((day, i) => {
            const isToday = formatDate(day) === todayStr
            const dayLessons = lessonsByDay(day)
            return (
              <Box key={i} sx={{ minHeight: 160 }}>
                {/* Day header */}
                <Box sx={{
                  textAlign: 'center', mb: 1.5, pb: 1.5,
                  borderBottom: 2, borderColor: isToday ? 'primary.main' : 'divider',
                }}>
                  <Typography variant="caption" fontWeight={500} sx={{ color: isToday ? 'primary.main' : 'text.disabled' }}>
                    {WEEKDAY_SHORT[i]}
                  </Typography>
                  <Typography variant="h6" fontWeight={700} sx={{ color: isToday ? 'primary.main' : 'text.secondary', lineHeight: 1.2 }}>
                    {day.getDate()}
                  </Typography>
                </Box>

                {/* Lessons */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {dayLessons.map(lesson => {
                    const assign = assignments.find(a => a.id === lesson.assignment_id)
                    const status = lessonStatus(lesson)
                    const typeSx = status === 'past' ? { bgcolor: '#F1F5F9', color: '#94a3b8' } : LESSON_TYPE_COLORS[lesson.lesson_type]
                    return (
                      <Paper
                        key={lesson.id}
                        elevation={0}
                        onClick={() => navigate(`/lessons/${lesson.id}`)}
                        sx={{
                          p: 1.5, cursor: 'pointer', borderRadius: 1.5,
                          border: '1px solid',
                          borderColor: status === 'active' ? '#34D399' : status === 'past' ? 'divider' : '#BFDBFE',
                          bgcolor: status === 'active' ? '#ECFDF5' : status === 'past' ? '#F8FAFC' : 'background.paper',
                          '&:hover': { boxShadow: 2 },
                        }}
                      >
                        <Typography variant="caption" fontWeight={600} sx={{ color: status === 'active' ? '#347856' : status === 'past' ? '#94a3b8' : 'text.primary', display: 'block', mb: 0.5 }}>
                          {fmtTime(lesson.starts_at)}–{fmtTime(lesson.ends_at)}
                        </Typography>
                        {assign && (
                          <>
                            <Typography variant="caption" sx={{ display: 'block', color: status === 'past' ? 'text.disabled' : 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mb: 0.25 }}>
                              {subjectName(assign.subject_id)}
                            </Typography>
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {groupName(assign.group_id)}
                            </Typography>
                          </>
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                          <Chip label={LESSON_TYPE_LABELS[lesson.lesson_type]} size="small" sx={{ ...typeSx, height: 18, fontSize: 10 }} />
                          {status === 'active' && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                              <FiberManualRecordRounded sx={{ fontSize: 8, color: '#347856' }} />
                              <Typography variant="caption" sx={{ color: '#347856', fontWeight: 600, fontSize: 10 }}>Идёт</Typography>
                            </Box>
                          )}
                        </Box>
                        {lesson.room && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.5 }}>
                            <PlaceRounded sx={{ fontSize: 11, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>{lesson.room}</Typography>
                          </Box>
                        )}
                      </Paper>
                    )
                  })}
                  {dayLessons.length === 0 && (
                    <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center', pt: 1 }}>—</Typography>
                  )}
                </Box>
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}
