import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lesson, LessonType } from '../../api/resources'
import { getLessons, getAssignments, createLesson, deleteLesson, getMyTeacherProfile } from '../../api/resources'
import type { TeachingAssignment } from '../../api/resources'
import { Overlay, Field, ConfirmDelete } from '../../components/CrudHelpers'
import client from '../../api/client'
import type { Subject, Group } from '../../api/resources'

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

function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  const result = new Date(d)
  result.setDate(d.getDate() + diff)
  result.setHours(0, 0, 0, 0)
  return result
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const WEEKDAY_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

export default function LessonsPage() {
  const navigate = useNavigate()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

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

  useEffect(() => { load() }, [weekStart])

  const subjectName = (id: number) => subjects.find(s => s.id === id)?.name ?? '—'
  const groupName = (id: number) => groups.find(g => g.id === id)?.name ?? '—'

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const lessonsByDay = (day: Date) => {
    const dateStr = formatDate(day)
    return lessons
      .filter(l => l.starts_at.slice(0, 10) === dateStr)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  }

  const handleDelete = async () => {
    if (deleteId === null) return
    await deleteLesson(deleteId)
    setDeleteId(null)
    load()
  }

  const weekLabel = () => {
    const end = addDays(weekStart, 6)
    const fmtDay = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    return `${fmtDay(weekStart)} — ${fmtDay(end)}`
  }

  return (
    <div className="p-8 max-w-6xl">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Расписание занятий</h1>
          <p className="text-slate-400 text-sm">{weekLabel()}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekStart(w => addDays(w, -7))}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600"
            title="Предыдущая неделя"
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
            title="Следующая неделя"
          >
            <ChevronRight />
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Занятие
          </button>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((day, i) => {
            const isToday = formatDate(day) === formatDate(new Date())
            const dayLessons = lessonsByDay(day)
            return (
              <div key={i} className="min-h-40">
                {/* Заголовок дня */}
                <div className={`text-center mb-2 pb-2 border-b ${isToday ? 'border-blue-300' : 'border-slate-200'}`}>
                  <p className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                    {WEEKDAY_SHORT[i]}
                  </p>
                  <p className={`text-lg font-semibold ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                    {day.getDate()}
                  </p>
                </div>

                {/* Занятия */}
                <div className="space-y-2">
                  {dayLessons.map(lesson => {
                    const assign = assignments.find(a => a.id === lesson.assignment_id)
                    return (
                      <div
                        key={lesson.id}
                        onClick={() => navigate(`/lessons/${lesson.id}`)}
                        className="bg-white rounded-lg border border-slate-100 shadow-sm p-2.5 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                      >
                        <p className="text-xs font-semibold text-slate-700 leading-tight mb-1 truncate">
                          {formatTime(lesson.starts_at)}–{formatTime(lesson.ends_at)}
                        </p>
                        {assign && (
                          <p className="text-xs text-slate-500 truncate mb-1">
                            {subjectName(assign.subject_id)}
                          </p>
                        )}
                        {assign && (
                          <p className="text-xs text-slate-400 truncate">{groupName(assign.group_id)}</p>
                        )}
                        <div className="flex items-center justify-between mt-1.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${LESSON_TYPE_COLORS[lesson.lesson_type]}`}>
                            {LESSON_TYPE_LABELS[lesson.lesson_type]}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteId(lesson.id) }}
                            className="text-slate-300 hover:text-red-500 transition-colors p-0.5"
                            title="Удалить"
                          >
                            <TrashMini />
                          </button>
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

      {createOpen && (
        <CreateLessonModal
          assignments={assignments}
          subjects={subjects}
          groups={groups}
          onClose={() => setCreateOpen(false)}
          onSave={() => { setCreateOpen(false); load() }}
        />
      )}

      {deleteId !== null && (
        <ConfirmDelete
          text="Удалить занятие? Записи о посещаемости за этот день не удалятся."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}

function CreateLessonModal({ assignments, subjects, groups, onClose, onSave }: {
  assignments: TeachingAssignment[]
  subjects: Subject[]
  groups: Group[]
  onClose: () => void
  onSave: () => void
}) {
  const today = new Date().toISOString().slice(0, 16)
  const [assignmentId, setAssignmentId] = useState('')
  const [startsAt, setStartsAt] = useState(today)
  const [endsAt, setEndsAt] = useState(today)
  const [topic, setTopic] = useState('')
  const [lessonType, setLessonType] = useState<LessonType>('lecture')
  const [room, setRoom] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const subjectName = (id: number) => subjects.find(s => s.id === id)?.name ?? '—'
  const groupName = (id: number) => groups.find(g => g.id === id)?.name ?? '—'

  const submit = async () => {
    if (!assignmentId) { setError('Выберите дисциплину / группу'); return }
    if (!startsAt || !endsAt) { setError('Укажите время'); return }
    if (endsAt <= startsAt) { setError('Время окончания должно быть позже начала'); return }
    setSaving(true)
    setError('')
    try {
      await createLesson({
        assignment_id: parseInt(assignmentId),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        topic: topic.trim() || undefined,
        lesson_type: lessonType,
        room: room.trim() || undefined,
      })
      onSave()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Ошибка сохранения')
      setSaving(false)
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-slate-800 mb-5">Новое занятие</h2>
      <Field label="Дисциплина / группа">
        <select value={assignmentId} onChange={e => setAssignmentId(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">— выберите —</option>
          {assignments.map(a => (
            <option key={a.id} value={a.id}>
              {subjectName(a.subject_id)} · {groupName(a.group_id)} ({a.acad_year}, сем. {a.semester})
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Начало">
          <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label="Конец">
          <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
      </div>
      <Field label="Тип занятия">
        <select value={lessonType} onChange={e => setLessonType(e.target.value as LessonType)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {(Object.entries(LESSON_TYPE_LABELS) as [LessonType, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </Field>
      <Field label="Тема (необязательно)">
        <input value={topic} onChange={e => setTopic(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </Field>
      <Field label="Аудитория (необязательно)">
        <input value={room} onChange={e => setRoom(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </Field>
      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
      <div className="flex justify-end gap-3 mt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
          Отмена
        </button>
        <button onClick={submit} disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? 'Создание...' : 'Создать'}
        </button>
      </div>
    </Overlay>
  )
}

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
function TrashMini() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" />
  </svg>
}
function Spinner() {
  return <div className="p-8 flex items-center gap-3 text-slate-400">
    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    Загрузка...
  </div>
}
