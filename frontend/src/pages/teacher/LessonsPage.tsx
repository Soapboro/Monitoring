import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lesson, LessonType } from '../../api/resources'
import { getLessons, getAssignments, getMyTeacherProfile } from '../../api/resources'
import type { TeachingAssignment } from '../../api/resources'
import client from '../../api/client'
import type { Subject, Group } from '../../api/resources'

// ── Constants ──────────────────────────────────────────────────────────────────

const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  lecture: 'Лекция',
  practice: 'Практика',
  lab: 'Лабораторная',
  seminar: 'Семинар',
  other: 'Другое',
}
const LESSON_TYPE_COLORS: Record<LessonType, string> = {
  lecture: 'bg-blue-100 text-blue-700',
  practice: 'bg-emerald-100 text-emerald-700',
  lab: 'bg-purple-100 text-purple-700',
  seminar: 'bg-amber-100 text-amber-700',
  other: 'bg-slate-100 text-slate-600',
}
const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

// ── Helpers ────────────────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const r = new Date(d)
  r.setDate(d.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

type LessonStatus = 'past' | 'active' | 'upcoming'

function lessonStatus(lesson: Lesson): LessonStatus {
  const now = new Date()
  const start = new Date(lesson.starts_at)
  const end = new Date(lesson.ends_at)
  if (now > end) return 'past'
  if (now >= start) return 'active'
  return 'upcoming'
}

// ── Page ───────────────────────────────────────────────────────────────────────

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
      setLessons(ls)
      setAssignments(assigns)
      setSubjects(subjs)
      setGroups(grps)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  const subjectName = (id: number) => subjects.find(s => s.id === id)?.name ?? '—'
  const groupName = (id: number) => groups.find(g => g.id === id)?.name ?? '—'
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const lessonsByDay = (day: Date) => {
    const dateStr = formatDate(day)
    return lessons
      .filter(l => l.starts_at.slice(0, 10) === dateStr)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  }

  const weekLabel = () => {
    const end = addDays(weekStart, 6)
    const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    return `${fmt(weekStart)} — ${fmt(end)}`
  }

  // Today's lessons for the banner
  const todayStr = formatDate(new Date())
  const todayLessons = lessons
    .filter(l => l.starts_at.slice(0, 10) === todayStr)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Мои занятия</h1>
          <p className="text-slate-400 text-sm">{weekLabel()}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(w => addDays(w, -7))}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600"
          >
            <ChevronLeft />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
          >
            Сегодня
          </button>
          <button
            onClick={() => setWeekStart(w => addDays(w, 7))}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600"
          >
            <ChevronRight />
          </button>
        </div>
      </div>

      {/* Today's lessons banner */}
      {!loading && todayLessons.length > 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-700 mb-3">
            Сегодня · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
          </p>
          <div className="flex flex-wrap gap-3">
            {todayLessons.map(lesson => {
              const assign = assignments.find(a => a.id === lesson.assignment_id)
              const status = lessonStatus(lesson)
              return (
                <button
                  key={lesson.id}
                  onClick={() => navigate(`/lessons/${lesson.id}`)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all hover:shadow-md cursor-pointer ${
                    status === 'active'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : status === 'past'
                      ? 'bg-white text-slate-500 border-slate-200'
                      : 'bg-white text-slate-700 border-blue-200 hover:border-blue-400'
                  }`}
                >
                  <div>
                    <p className={`text-xs font-bold mb-0.5 ${status === 'active' ? 'text-emerald-100' : 'text-slate-400'}`}>
                      {fmtTime(lesson.starts_at)}–{fmtTime(lesson.ends_at)}
                    </p>
                    <p className="text-sm font-semibold">
                      {assign ? subjectName(assign.subject_id) : '—'}
                    </p>
                    <p className={`text-xs mt-0.5 ${status === 'active' ? 'text-emerald-100' : 'text-slate-400'}`}>
                      {assign ? groupName(assign.group_id) : ''}
                      {lesson.room ? ` · ${lesson.room}` : ''}
                    </p>
                  </div>
                  <div className="ml-auto pl-4">
                    {status === 'active' && (
                      <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded-full whitespace-nowrap">Идёт сейчас</span>
                    )}
                    {status === 'upcoming' && (
                      <span className="text-xs text-blue-600 font-medium whitespace-nowrap">Открыть журнал →</span>
                    )}
                    {status === 'past' && (
                      <span className="text-xs text-slate-400 whitespace-nowrap">Просмотр →</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Weekly calendar */}
      {loading ? <Spinner /> : (
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((day, i) => {
            const isToday = formatDate(day) === todayStr
            const dayLessons = lessonsByDay(day)
            return (
              <div key={i} className="min-h-40">
                <div className={`text-center mb-2 pb-2 border-b ${isToday ? 'border-blue-300' : 'border-slate-200'}`}>
                  <p className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                    {WEEKDAY_SHORT[i]}
                  </p>
                  <p className={`text-lg font-semibold ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                    {day.getDate()}
                  </p>
                </div>

                <div className="space-y-2">
                  {dayLessons.map(lesson => {
                    const assign = assignments.find(a => a.id === lesson.assignment_id)
                    const status = lessonStatus(lesson)
                    return (
                      <div
                        key={lesson.id}
                        onClick={() => navigate(`/lessons/${lesson.id}`)}
                        className={`rounded-lg border p-2.5 cursor-pointer transition-all shadow-sm ${
                          status === 'active'
                            ? 'bg-emerald-50 border-emerald-300 hover:shadow-md'
                            : status === 'past'
                            ? 'bg-slate-50 border-slate-100 hover:border-slate-200'
                            : 'bg-white border-slate-100 hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        <p className={`text-xs font-semibold leading-tight mb-1 ${
                          status === 'active' ? 'text-emerald-700' :
                          status === 'past' ? 'text-slate-400' : 'text-slate-700'
                        }`}>
                          {fmtTime(lesson.starts_at)}–{fmtTime(lesson.ends_at)}
                        </p>
                        {assign && (
                          <>
                            <p className={`text-xs truncate mb-0.5 ${status === 'past' ? 'text-slate-400' : 'text-slate-600'}`}>
                              {subjectName(assign.subject_id)}
                            </p>
                            <p className="text-xs text-slate-400 truncate">{groupName(assign.group_id)}</p>
                          </>
                        )}
                        <div className="flex items-center justify-between mt-1.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            status === 'past' ? 'bg-slate-100 text-slate-400' : LESSON_TYPE_COLORS[lesson.lesson_type]
                          }`}>
                            {LESSON_TYPE_LABELS[lesson.lesson_type]}
                          </span>
                          {status === 'active' && (
                            <span className="text-xs font-semibold text-emerald-600">● Идёт</span>
                          )}
                        </div>
                        {lesson.room && (
                          <p className="text-xs text-slate-400 mt-1">📍 {lesson.room}</p>
                        )}
                      </div>
                    )
                  })}
                  {dayLessons.length === 0 && (
                    <p className="text-xs text-slate-300 text-center pt-2">—</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function ChevronLeft() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
}
function ChevronRight() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
}
function Spinner() {
  return <div className="p-8 flex items-center gap-3 text-slate-400">
    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    Загрузка...
  </div>
}
