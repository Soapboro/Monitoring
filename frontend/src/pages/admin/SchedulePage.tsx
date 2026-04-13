import { useEffect, useState, useCallback } from 'react'
import type { LessonType, TeachingAssignment, Subject, Group, TeacherProfile } from '../../api/resources'
import {
  getLessons, createLesson, updateLesson, deleteLesson,
  getTeachers, getGroups, getSubjects,
} from '../../api/resources'
import { getAllAssignments } from '../../api/resources'
import type { Lesson } from '../../api/resources'
import { Overlay, Field, ConfirmDelete } from '../../components/CrudHelpers'

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

  // ── Lookups ──────────────────────────────────────────────────────────────────

  const subjectName = (id: number) => subjects.find(s => s.id === id)?.name ?? '—'
  const groupName = (id: number) => groups.find(g => g.id === id)?.name ?? '—'
  const teacherName = (id: number) => {
    const t = teachers.find(t => t.id === id)
    return t ? `${t.last_name} ${t.first_name[0]}.${t.middle_name ? t.middle_name[0] + '.' : ''}` : '—'
  }
  const assignmentInfo = (aId: number) => assignments.find(a => a.id === aId)

  // ── Load ─────────────────────────────────────────────────────────────────────

  const loadLessons = useCallback(async () => {
    setLoading(true)
    try {
      const dateFrom = weekStart.toISOString()
      const dateTo = addDays(weekStart, 7).toISOString()
      const params: Record<string, string | undefined> = { date_from: dateFrom, date_to: dateTo }
      if (teacherFilter !== 'all') params.teacher_id = teacherFilter
      const ls = await getLessons(params as Parameters<typeof getLessons>[0])
      setLessons(ls)
    } finally {
      setLoading(false)
    }
  }, [weekStart, teacherFilter])

  useEffect(() => {
    // Load static data once
    Promise.all([getTeachers(), getGroups(), getSubjects(), getAllAssignments()])
      .then(([ts, gs, ss, as]) => {
        setTeachers(ts)
        setGroups(gs)
        setSubjects(ss)
        setAssignments(as)
      })
  }, [])

  useEffect(() => { loadLessons() }, [loadLessons])

  // ── Derived data ─────────────────────────────────────────────────────────────

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const visibleLessons = groupFilter === 'all'
    ? lessons
    : lessons.filter(l => {
        const a = assignmentInfo(l.assignment_id)
        return a?.group_id === parseInt(groupFilter)
      })

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

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const totalThisWeek = visibleLessons.length

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (deleteId === null) return
    await deleteLesson(deleteId)
    setDeleteId(null)
    loadLessons()
  }

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 mb-0.5">Расписание занятий</h1>
          <p className="text-slate-400 text-sm">{weekLabel()} · {totalThisWeek} занятий</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Filters */}
          <select
            value={teacherFilter}
            onChange={e => setTeacherFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="all">Все преподаватели</option>
            {teachers.map(t => (
              <option key={t.id} value={String(t.id)}>
                {t.last_name} {t.first_name[0]}. {t.middle_name ? t.middle_name[0] + '.' : ''}
              </option>
            ))}
          </select>
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="all">Все группы</option>
            {groups.filter(g => g.is_active).map(g => (
              <option key={g.id} value={String(g.id)}>{g.name}</option>
            ))}
          </select>

          {/* Week nav */}
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

          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + Занятие
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      {loading ? <Spinner /> : (
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((day, i) => {
            const isToday = formatDate(day) === formatDate(new Date())
            const dayLessons = lessonsByDay(day)
            return (
              <div key={i} className="min-h-48">
                {/* Day header */}
                <div className={`text-center mb-2 pb-2 border-b ${isToday ? 'border-blue-400' : 'border-slate-200'}`}>
                  <p className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                    {WEEKDAY_SHORT[i]}
                  </p>
                  <p className={`text-lg font-semibold ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                    {day.getDate()}
                  </p>
                  {dayLessons.length > 0 && (
                    <p className="text-xs text-slate-400">{dayLessons.length} зан.</p>
                  )}
                </div>

                {/* Lessons */}
                <div className="space-y-2">
                  {dayLessons.map(lesson => {
                    const assign = assignmentInfo(lesson.assignment_id)
                    return (
                      <div
                        key={lesson.id}
                        className="bg-white rounded-lg border border-slate-100 shadow-sm p-2.5 hover:border-slate-300 hover:shadow-md transition-all group"
                      >
                        <p className="text-xs font-semibold text-slate-700 leading-tight mb-1">
                          {fmtTime(lesson.starts_at)}–{fmtTime(lesson.ends_at)}
                        </p>
                        {assign && (
                          <>
                            <p className="text-xs text-slate-600 font-medium truncate mb-0.5">
                              {subjectName(assign.subject_id)}
                            </p>
                            <p className="text-xs text-slate-400 truncate mb-0.5">{groupName(assign.group_id)}</p>
                            <p className="text-xs text-slate-400 truncate">{teacherName(assign.teacher_id)}</p>
                          </>
                        )}
                        {lesson.topic && (
                          <p className="text-xs text-slate-400 italic truncate mt-0.5">{lesson.topic}</p>
                        )}
                        <div className="flex items-center justify-between mt-1.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${LESSON_TYPE_COLORS[lesson.lesson_type]}`}>
                            {LESSON_TYPE_LABELS[lesson.lesson_type]}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditLesson(lesson)}
                              className="p-0.5 text-slate-400 hover:text-blue-500 transition-colors"
                              title="Редактировать"
                            >
                              <PencilMini />
                            </button>
                            <button
                              onClick={() => setDeleteId(lesson.id)}
                              className="p-0.5 text-slate-400 hover:text-red-500 transition-colors"
                              title="Удалить"
                            >
                              <TrashMini />
                            </button>
                          </div>
                        </div>
                        {lesson.room && (
                          <p className="text-xs text-slate-400 mt-0.5">📍 {lesson.room}</p>
                        )}
                      </div>
                    )
                  })}
                  {dayLessons.length === 0 && (
                    <p className="text-xs text-slate-300 text-center pt-4">—</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {createOpen && (
        <LessonFormModal
          teachers={teachers}
          assignments={assignments}
          subjects={subjects}
          groups={groups}
          title="Новое занятие"
          defaultDate={formatDate(new Date())}
          onClose={() => setCreateOpen(false)}
          onSave={() => { setCreateOpen(false); loadLessons() }}
        />
      )}
      {editLesson && (
        <EditLessonModal
          lesson={editLesson}
          onClose={() => setEditLesson(null)}
          onSave={() => { setEditLesson(null); loadLessons() }}
        />
      )}
      {deleteId !== null && (
        <ConfirmDelete
          text="Удалить это занятие из расписания? Записи о посещаемости не удалятся."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}

// ── Create modal ───────────────────────────────────────────────────────────────

function LessonFormModal({ teachers, assignments, subjects, groups, title, defaultDate, onClose, onSave }: {
  teachers: TeacherProfile[]
  assignments: TeachingAssignment[]
  subjects: Subject[]
  groups: Group[]
  title: string
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

  const teacherAssignments = assignments.filter(
    a => teacherId ? a.teacher_id === parseInt(teacherId) : false
  )

  const subjectName = (id: number) => subjects.find(s => s.id === id)?.name ?? '—'
  const groupName = (id: number) => groups.find(g => g.id === id)?.name ?? '—'

  const submit = async () => {
    if (!teacherId) { setError('Выберите преподавателя'); return }
    if (!assignmentId) { setError('Выберите дисциплину / группу'); return }
    if (!date) { setError('Укажите дату'); return }
    if (!timeStart || !timeEnd) { setError('Укажите время'); return }
    if (timeEnd <= timeStart) { setError('Время окончания должно быть позже начала'); return }
    setSaving(true)
    setError('')
    try {
      const starts_at = new Date(`${date}T${timeStart}`).toISOString()
      const ends_at = new Date(`${date}T${timeEnd}`).toISOString()
      await createLesson({
        assignment_id: parseInt(assignmentId),
        starts_at,
        ends_at,
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
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-slate-800 mb-5">{title}</h2>

      <Field label="Преподаватель">
        <select
          value={teacherId}
          onChange={e => { setTeacherId(e.target.value); setAssignmentId('') }}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— выберите —</option>
          {teachers.map(t => (
            <option key={t.id} value={String(t.id)}>
              {t.last_name} {t.first_name} {t.middle_name ?? ''}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Дисциплина / группа">
        <select
          value={assignmentId}
          onChange={e => setAssignmentId(e.target.value)}
          disabled={!teacherId}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="">— выберите —</option>
          {teacherAssignments.map(a => (
            <option key={a.id} value={String(a.id)}>
              {subjectName(a.subject_id)} · {groupName(a.group_id)} ({a.acad_year}, сем. {a.semester})
            </option>
          ))}
        </select>
        {teacherId && teacherAssignments.length === 0 && (
          <p className="text-xs text-amber-500 mt-1">Нет назначений у этого преподавателя</p>
        )}
      </Field>

      <Field label="Дата">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Начало">
          <input
            type="time"
            value={timeStart}
            onChange={e => setTimeStart(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Field>
        <Field label="Конец">
          <input
            type="time"
            value={timeEnd}
            onChange={e => setTimeEnd(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Field>
      </div>

      <Field label="Тип занятия">
        <select
          value={lessonType}
          onChange={e => setLessonType(e.target.value as LessonType)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {(Object.entries(LESSON_TYPE_LABELS) as [LessonType, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </Field>

      <Field label="Тема (необязательно)">
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="Тема занятия"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>

      <Field label="Аудитория (необязательно)">
        <input
          value={room}
          onChange={e => setRoom(e.target.value)}
          placeholder="А-205"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <div className="flex justify-end gap-3 mt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
          Отмена
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Создание...' : 'Создать'}
        </button>
      </div>
    </Overlay>
  )
}

// ── Edit modal ─────────────────────────────────────────────────────────────────

function EditLessonModal({ lesson, onClose, onSave }: {
  lesson: Lesson
  onClose: () => void
  onSave: () => void
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
    setSaving(true)
    setError('')
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
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-slate-800 mb-5">Редактировать занятие</h2>

      <Field label="Дата">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Начало">
          <input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label="Конец">
          <input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)}
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
      <Field label="Тема">
        <input value={topic} onChange={e => setTopic(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </Field>
      <Field label="Аудитория">
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
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </Overlay>
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
function TrashMini() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" />
  </svg>
}
function PencilMini() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15.232 5.232l3.536 3.536M9 13l6.5-6.5a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414A2 2 0 018.586 12.5z" />
  </svg>
}
function Spinner() {
  return <div className="p-8 flex items-center gap-3 text-slate-400">
    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    Загрузка...
  </div>
}
