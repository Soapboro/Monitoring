import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import type { TeacherProfile, TeachingAssignment, Subject, Group } from '../../api/resources'
import { getSubjects, getGroups, createAssignment, deleteAssignment } from '../../api/resources'
import { Overlay, Field, ConfirmDelete, TrashIcon } from '../../components/CrudHelpers'

interface Department { id: number; name: string }

interface GroupAssignments {
  group: Group
  items: { assignment: TeachingAssignment; subject: Subject; deptName: string | null }[]
}

const CONTROL_FORMS = ['Экзамен', 'Зачёт', 'Дифференцированный зачёт', 'Контрольная работа', 'Курсовая работа', 'Реферат']

export default function TeacherDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [teacher, setTeacher] = useState<TeacherProfile | null>(null)
  const [groups, setGroups] = useState<GroupAssignments[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = async () => {
    if (!id) return
    try {
      const [t, assignments] = await Promise.all([
        client.get<TeacherProfile>(`/teachers/${id}`).then(r => r.data),
        client.get<TeachingAssignment[]>('/teaching-assignments', { params: { teacher_id: id } }).then(r => r.data),
      ])
      setTeacher(t)

      const subjectIds = [...new Set(assignments.map(a => a.subject_id))]
      const groupIds = [...new Set(assignments.map(a => a.group_id))]

      const [subjects, grps] = await Promise.all([
        Promise.all(subjectIds.map(sid =>
          client.get<Subject>(`/subjects/${sid}`).then(r => r.data).catch(() => null)
        )),
        Promise.all(groupIds.map(gid =>
          client.get<Group>(`/groups/${gid}`).then(r => r.data).catch(() => null)
        )),
      ])

      const subjectMap: Record<number, Subject> = {}
      for (const s of subjects) if (s) subjectMap[s.id] = s

      const groupMap: Record<number, Group> = {}
      for (const g of grps) if (g) groupMap[g.id] = g

      const deptIds = [...new Set(subjects.map(s => s?.department_id).filter(Boolean) as number[])]
      const deptMap: Record<number, string> = {}
      await Promise.all(deptIds.map(did =>
        client.get<Department>(`/departments/${did}`).then(r => { deptMap[did] = r.data.name }).catch(() => {})
      ))

      const byGroup: Record<number, GroupAssignments> = {}
      for (const a of assignments) {
        const grp = groupMap[a.group_id]
        const subj = subjectMap[a.subject_id]
        if (!grp || !subj) continue
        if (!byGroup[a.group_id]) byGroup[a.group_id] = { group: grp, items: [] }
        byGroup[a.group_id].items.push({
          assignment: a,
          subject: subj,
          deptName: subj.department_id ? (deptMap[subj.department_id] ?? null) : null,
        })
      }

      const result = Object.values(byGroup).sort((a, b) => a.group.name.localeCompare(b.group.name))
      setGroups(result)
      if (result.length > 0 && expanded === null) setExpanded(result[0].group.id)
    } catch {
      // silent
    }
  }

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (deleteId === null) return
    await deleteAssignment(deleteId)
    setDeleteId(null)
    await load()
  }

  if (loading) return <Spinner />
  if (!teacher) return <div className="p-8 text-slate-400">Преподаватель не найден</div>

  const fullName = `${teacher.last_name} ${teacher.first_name}${teacher.middle_name ? ' ' + teacher.middle_name : ''}`
  const totalSubjects = groups.reduce((s, g) => s + g.items.length, 0)

  return (
    <div className="p-8 max-w-5xl">
      {/* Хлебные крошки */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-400 mb-6">
        <button onClick={() => navigate('/teachers')} className="hover:text-blue-600 cursor-pointer transition-colors">
          Преподаватели
        </button>
        <Chevron />
        <span className="text-slate-600 font-medium">{teacher.last_name} {teacher.first_name}</span>
      </nav>

      {/* Шапка */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
            <span className="text-lg font-semibold text-purple-600">{teacher.last_name[0]}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-slate-800">{fullName}</h1>
            <p className="text-slate-400 text-sm mt-0.5">{teacher.position ?? 'Должность не указана'}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-100">
          <Stat label="Групп" value={groups.length} />
          <Stat label="Назначений" value={totalSubjects} />
          <div>
            <p className="text-xs text-slate-400">Телефон</p>
            <p className="text-sm font-medium text-slate-700 mt-0.5">{teacher.phone ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Заголовок секции */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold text-slate-700">Преподаваемые предметы</h2>
          <span className="text-xs text-slate-400">{groups.length} групп</span>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          + Добавить назначение
        </button>
      </div>

      {groups.length === 0 ? (
        <Empty text="Нет назначений" />
      ) : (
        <div className="space-y-2">
          {groups.map(({ group, items }) => {
            const isOpen = expanded === group.id
            return (
              <div key={group.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : group.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/groups/${group.id}`) }}
                      className="font-medium text-blue-600 hover:underline text-sm cursor-pointer"
                    >
                      {group.name}
                    </button>
                    <span className="text-xs text-slate-400">набор {group.year_start}</span>
                  </div>
                  <span className="text-xs text-slate-400">{items.length} предм.</span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-6 py-2.5 text-slate-500 font-medium text-xs">Предмет</th>
                          <th className="text-left px-4 py-2.5 text-slate-500 font-medium text-xs">Кафедра</th>
                          <th className="text-left px-4 py-2.5 text-slate-500 font-medium text-xs">Год / сем.</th>
                          <th className="text-left px-4 py-2.5 text-slate-500 font-medium text-xs">Форма контроля</th>
                          <th className="w-16" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {items.map(({ assignment, subject, deptName }) => (
                          <tr
                            key={assignment.id}
                            onClick={() => navigate(`/assignments/${assignment.id}`)}
                            className="hover:bg-blue-50 cursor-pointer transition-colors"
                          >
                            <td className="px-6 py-3 text-slate-800 font-medium">{subject.name}</td>
                            <td className="px-4 py-3 text-slate-500">{deptName ?? '—'}</td>
                            <td className="px-4 py-3 text-slate-500">{assignment.acad_year} / {assignment.semester}</td>
                            <td className="px-4 py-3 text-slate-500">{assignment.control_form ?? '—'}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={e => { e.stopPropagation(); setDeleteId(assignment.id) }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Удалить назначение"
                              >
                                <TrashIcon />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showAddModal && teacher && (
        <AddAssignmentModal
          teacherId={teacher.id}
          onClose={() => setShowAddModal(false)}
          onSave={async () => { setShowAddModal(false); await load() }}
        />
      )}

      {deleteId !== null && (
        <ConfirmDelete
          text="Удалить назначение? Связанные оценки и посещаемость останутся."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}

function AddAssignmentModal({ teacherId, onClose, onSave }: {
  teacherId: number
  onClose: () => void
  onSave: () => void
}) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [subjectId, setSubjectId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [acadYear, setAcadYear] = useState(() => {
    const y = new Date().getFullYear()
    return `${y}-${y + 1}`
  })
  const [semester, setSemester] = useState('1')
  const [controlForm, setControlForm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    Promise.all([getSubjects(), getGroups()])
      .then(([s, g]) => { setSubjects(s); setGroups(g) })
      .finally(() => setLoadingData(false))
  }, [])

  const submit = async () => {
    if (!subjectId) { setError('Выберите предмет'); return }
    if (!groupId) { setError('Выберите группу'); return }
    if (!acadYear.trim()) { setError('Укажите учебный год'); return }
    setSaving(true); setError('')
    try {
      await createAssignment({
        teacher_id: teacherId,
        subject_id: parseInt(subjectId),
        group_id: parseInt(groupId),
        semester: parseInt(semester),
        acad_year: acadYear.trim(),
        ...(controlForm ? { control_form: controlForm } : {}),
      })
      onSave()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Ошибка сохранения')
      setSaving(false)
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-slate-800 mb-5">Новое назначение</h2>
      {loadingData ? (
        <div className="flex justify-center py-8 text-slate-400">Загрузка...</div>
      ) : (
        <>
          <Field label="Предмет">
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— выберите предмет —</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Группа">
            <select value={groupId} onChange={e => setGroupId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— выберите группу —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="Учебный год">
            <input value={acadYear} onChange={e => setAcadYear(e.target.value)}
              placeholder="2024-2025"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
          <Field label="Семестр">
            <select value={semester} onChange={e => setSemester(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </Field>
          <Field label="Форма контроля (необязательно)">
            <select value={controlForm} onChange={e => setControlForm(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— не указана —</option>
              {CONTROL_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <div className="flex justify-end gap-3 mt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">Отмена</button>
            <button onClick={submit} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </>
      )}
    </Overlay>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-xl font-bold text-slate-800 mt-0.5">{value}</p>
    </div>
  )
}
function Chevron() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}
function Spinner() {
  return (
    <div className="p-8 flex items-center gap-3 text-slate-400">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      Загрузка...
    </div>
  )
}
function Empty({ text }: { text: string }) {
  return <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400 shadow-sm">{text}</div>
}
