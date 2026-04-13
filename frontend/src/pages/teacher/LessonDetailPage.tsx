import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Lesson, LessonType, StudentProfile, AttendanceRecord, GradeRecord } from '../../api/resources'
import { getLesson, updateLesson, bulkAttendance, updateAttendance, createGrade, updateGrade, deleteGrade } from '../../api/resources'
import client from '../../api/client'
import type { Subject, Group, TeachingAssignment } from '../../api/resources'
import { Overlay, Field } from '../../components/CrudHelpers'

// ── Constants ──────────────────────────────────────────────────────────────────

const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  lecture: 'Лекция', practice: 'Практика', lab: 'Лабораторная', seminar: 'Семинар', other: 'Другое',
}
const LESSON_TYPE_COLORS: Record<LessonType, string> = {
  lecture: 'bg-blue-100 text-blue-700', practice: 'bg-emerald-100 text-emerald-700',
  lab: 'bg-purple-100 text-purple-700', seminar: 'bg-amber-100 text-amber-700', other: 'bg-slate-100 text-slate-600',
}

const GRADE_TYPE_LABELS: Record<string, string> = {
  current: 'Текущая', thematic: 'Тематическая', midterm: 'Промежуточная',
  final: 'Итоговая', attendance: 'За посещ.',
}

type LessonStatus = 'upcoming' | 'active' | 'past'

function getLessonStatus(lesson: Lesson): LessonStatus {
  const now = new Date()
  const start = new Date(lesson.starts_at)
  const end = new Date(lesson.ends_at)
  if (now > end) return 'past'
  if (now >= start) return 'active'
  return 'upcoming'
}

// ── Types ──────────────────────────────────────────────────────────────────────

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

// ── Page ───────────────────────────────────────────────────────────────────────

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

  // "started" state: upcoming lessons require explicit start action
  const [started, setStarted] = useState(false)

  const lessonDate = lesson ? lesson.starts_at.slice(0, 10) : ''
  const status: LessonStatus = lesson ? getLessonStatus(lesson) : 'upcoming'
  // Journal is visible when lesson is active/past, or when teacher clicked "Start"
  const journalVisible = status !== 'upcoming' || started

  // ── Load ───────────────────────────────────────────────────────────────────

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

      setSubject(subj)
      setGroup(grp)

      const date = l.starts_at.slice(0, 10)
      const attByStudent = Object.fromEntries(
        attRecords.filter(a => a.lesson_date === date).map(a => [a.student_id, a])
      )
      // latest grade per student on this date
      const gradeByStudent = Object.fromEntries(
        gradeRecords
          .filter(g => g.date_recorded === date)
          .sort((a, b) => b.id - a.id)
          .map(g => [g.student_id, g])
      )

      setRows(groupStudents.map(s => {
        const att = attByStudent[s.id] ?? null
        const grade = gradeByStudent[s.id] ?? null
        return {
          student: s,
          attendance: att,
          grade,
          isPresent: att ? att.is_present : true,
          gradeValue: grade?.value != null ? String(grade.value) : '',
          gradeType: grade?.grade_type ?? 'current',
          gradeComment: grade?.comment ?? '',
          dirty: false,
          gradeDirty: false,
        }
      }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start lesson ───────────────────────────────────────────────────────────

  const handleStartLesson = () => {
    // Pre-mark all students as present if no attendance recorded yet
    setRows(prev => prev.map(r => ({
      ...r,
      isPresent: r.attendance ? r.isPresent : true,
      dirty: r.attendance ? r.dirty : true,
    })))
    setStarted(true)
  }

  // ── Attendance / Grades ────────────────────────────────────────────────────

  const togglePresence = (studentId: number) => {
    setRows(prev => prev.map(r =>
      r.student.id === studentId ? { ...r, isPresent: !r.isPresent, dirty: true } : r
    ))
  }
  const setGradeValue = (studentId: number, val: string) => {
    setRows(prev => prev.map(r =>
      r.student.id === studentId ? { ...r, gradeValue: val, gradeDirty: true } : r
    ))
  }
  const setGradeType = (studentId: number, val: string) => {
    setRows(prev => prev.map(r =>
      r.student.id === studentId ? { ...r, gradeType: val, gradeDirty: true } : r
    ))
  }
  const setGradeComment = (studentId: number, val: string) => {
    setRows(prev => prev.map(r =>
      r.student.id === studentId ? { ...r, gradeComment: val, gradeDirty: true } : r
    ))
  }
  const markAll = (present: boolean) => {
    setRows(prev => prev.map(r => ({ ...r, isPresent: present, dirty: true })))
  }

  const saveAll = async () => {
    if (!lesson || !assignment) return
    setSaving(true)
    try {
      // Attendance
      const dirtyAtt = rows.filter(r => r.dirty)
      if (dirtyAtt.length > 0) {
        const existing = dirtyAtt.filter(r => r.attendance !== null)
        const newOnes = dirtyAtt.filter(r => r.attendance === null)
        await Promise.all(existing.map(r =>
          updateAttendance(r.attendance!.id, { is_present: r.isPresent })
        ))
        if (newOnes.length > 0) {
          await bulkAttendance({
            assignment_id: assignment.id,
            lesson_date: lessonDate,
            records: newOnes.map(r => ({ student_id: r.student.id, is_present: r.isPresent })),
          })
        }
      }

      // Grades
      const dirtyGrades = rows.filter(r => r.gradeDirty)
      await Promise.all(dirtyGrades.map(async r => {
        const val = r.gradeValue.trim() ? parseFloat(r.gradeValue) : undefined
        const hasData = r.gradeValue.trim() || r.gradeComment.trim()
        if (r.grade) {
          if (!hasData) {
            await deleteGrade(r.grade.id)
          } else {
            await updateGrade(r.grade.id, {
              value: val,
              comment: r.gradeComment.trim() || undefined,
            })
          }
        } else if (hasData) {
          await createGrade({
            student_id: r.student.id,
            assignment_id: assignment.id,
            grade_type: r.gradeType,
            value: val,
            comment: r.gradeComment.trim() || undefined,
            date_recorded: lessonDate,
          })
        }
      }))

      setSavedMsg('Сохранено')
      setTimeout(() => setSavedMsg(''), 2500)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const hasDirty = rows.some(r => r.dirty || r.gradeDirty)

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <Spinner />
  if (!lesson) return <div className="p-8 text-slate-400">Занятие не найдено</div>

  const dateStr = new Date(lesson.starts_at).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', weekday: 'long',
  })
  const timeStr = `${fmt(lesson.starts_at)}–${fmt(lesson.ends_at)}`
  const presentCount = rows.filter(r => r.isPresent).length

  return (
    <div className="p-8 max-w-5xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-400 mb-6">
        <button onClick={() => navigate('/lessons')} className="hover:text-blue-600 transition-colors cursor-pointer">
          Занятия
        </button>
        <ChevronIcon />
        <span className="text-slate-600 font-medium capitalize">
          {new Date(lesson.starts_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
        </span>
      </nav>

      {/* Lesson info card */}
      <div className={`bg-white rounded-xl border p-6 shadow-sm mb-6 ${
        status === 'active' ? 'border-emerald-300' :
        status === 'past' ? 'border-slate-200' :
        'border-blue-200'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${LESSON_TYPE_COLORS[lesson.lesson_type]}`}>
                {LESSON_TYPE_LABELS[lesson.lesson_type]}
              </span>
              <span className="text-sm text-slate-500">{timeStr}</span>
              {lesson.room && <span className="text-sm text-slate-400">· 📍 {lesson.room}</span>}

              {/* Status badge */}
              {status === 'active' && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 animate-pulse">
                  Идёт сейчас
                </span>
              )}
              {status === 'upcoming' && !started && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                  Предстоящее
                </span>
              )}
              {status === 'upcoming' && started && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                  Начато досрочно
                </span>
              )}
              {status === 'past' && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  Прошедшее
                </span>
              )}
            </div>

            <h1 className="text-xl font-semibold text-slate-800">
              {subject?.name ?? '—'}
            </h1>
            {lesson.topic && <p className="text-slate-500 text-sm mt-1">{lesson.topic}</p>}
            <p className="text-slate-400 text-sm mt-1 capitalize">
              {group?.name ?? '—'} · {dateStr}
            </p>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="shrink-0 text-sm text-slate-400 hover:text-blue-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:border-blue-300 transition-colors"
          >
            Редактировать
          </button>
        </div>

        {/* Stats row */}
        {journalVisible && (
          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-100">
            <div><p className="text-xs text-slate-400">Студентов</p><p className="text-xl font-bold text-slate-800">{rows.length}</p></div>
            <div><p className="text-xs text-slate-400">Присутствуют</p><p className="text-xl font-bold text-emerald-600">{presentCount}</p></div>
            <div><p className="text-xs text-slate-400">Отсутствуют</p><p className="text-xl font-bold text-red-500">{rows.length - presentCount}</p></div>
          </div>
        )}
      </div>

      {/* ── Upcoming: Start Lesson CTA ── */}
      {status === 'upcoming' && !started && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6 flex items-center justify-between">
          <div>
            <p className="font-semibold text-blue-800 mb-1">Занятие ещё не началось</p>
            <p className="text-sm text-blue-600">
              Запланировано на {fmtNice(lesson.starts_at)}.
              Нажмите «Начать занятие», чтобы открыть журнал посещаемости и оценок.
            </p>
          </div>
          <button
            onClick={handleStartLesson}
            className="ml-6 shrink-0 px-5 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            Начать занятие
          </button>
        </div>
      )}

      {/* ── Journal ── */}
      {journalVisible && (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <h2 className="text-base font-semibold text-slate-700">
              Журнал занятия
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => markAll(true)} className="text-xs text-emerald-600 hover:underline cursor-pointer">
                Все присутствуют
              </button>
              <button onClick={() => markAll(false)} className="text-xs text-red-500 hover:underline cursor-pointer">
                Все отсутствуют
              </button>
              {savedMsg && <span className="text-xs text-emerald-600 font-medium">{savedMsg}</span>}
              <button
                onClick={saveAll}
                disabled={saving || !hasDirty}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">
              В группе нет студентов
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-slate-500 font-medium w-8">#</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Студент</th>
                    <th className="text-center px-4 py-3 text-slate-500 font-medium w-28">Присутствие</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium w-24">Тип оценки</th>
                    <th className="text-center px-4 py-3 text-slate-500 font-medium w-20">Оценка</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Комментарий</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row, i) => (
                    <tr
                      key={row.student.id}
                      className={row.dirty || row.gradeDirty ? 'bg-blue-50/40' : 'hover:bg-slate-50'}
                    >
                      <td className="px-6 py-3 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                            row.isPresent ? 'bg-emerald-100' : 'bg-red-50'
                          }`}>
                            <span className={`text-xs font-semibold ${row.isPresent ? 'text-emerald-600' : 'text-red-400'}`}>
                              {row.student.last_name[0]}
                            </span>
                          </div>
                          <div>
                            <p className="text-slate-800 font-medium leading-tight">
                              {row.student.last_name} {row.student.first_name}
                              {row.student.middle_name ? ` ${row.student.middle_name}` : ''}
                            </p>
                            {row.student.student_num && (
                              <p className="text-xs text-slate-400">{row.student.student_num}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => togglePresence(row.student.id)}
                          title={row.isPresent ? 'Присутствует' : 'Отсутствует'}
                          className={`w-9 h-9 rounded-full flex items-center justify-center mx-auto transition-colors font-bold text-base cursor-pointer ${
                            row.isPresent
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-red-100 text-red-600 hover:bg-red-200'
                          }`}
                        >
                          {row.isPresent ? '✓' : '✗'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={row.gradeType}
                          onChange={e => setGradeType(row.student.id, e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        >
                          {Object.entries(GRADE_TYPE_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="1" max="5" step="0.5"
                          value={row.gradeValue}
                          onChange={e => setGradeValue(row.student.id, e.target.value)}
                          placeholder="—"
                          className="w-16 border border-slate-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={row.gradeComment}
                          onChange={e => setGradeComment(row.student.id, e.target.value)}
                          placeholder="—"
                          className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Bottom save bar */}
              {hasDirty && (
                <div className="px-6 py-3 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
                  <p className="text-xs text-blue-600">Есть несохранённые изменения</p>
                  <button
                    onClick={saveAll}
                    disabled={saving}
                    className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Edit modal */}
      {editOpen && lesson && (
        <EditLessonModal
          lesson={lesson}
          onClose={() => setEditOpen(false)}
          onSave={() => { setEditOpen(false); load() }}
        />
      )}
    </div>
  )
}

// ── Edit lesson modal ──────────────────────────────────────────────────────────

function EditLessonModal({ lesson, onClose, onSave }: {
  lesson: Lesson; onClose: () => void; onSave: () => void
}) {
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
    setSaving(true)
    setError('')
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
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-slate-800 mb-5">Редактировать занятие</h2>
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
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors cursor-pointer">
          Отмена
        </button>
        <button onClick={submit} disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer">
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </Overlay>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
function fmtNice(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })
}
function ChevronIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
}
function Spinner() {
  return <div className="p-8 flex items-center gap-3 text-slate-400">
    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    Загрузка...
  </div>
}
