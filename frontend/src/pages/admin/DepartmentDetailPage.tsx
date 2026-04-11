import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import type { Subject, Department, Group, TeacherProfile } from '../../api/resources'
import { updateSubject, updateGroup, getAllTeachers, setTeacherDepartment } from '../../api/resources'
import { Overlay, TrashIcon } from '../../components/CrudHelpers'

export default function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [dept, setDept] = useState<Department | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [teachers, setTeachers] = useState<TeacherProfile[]>([])
  const [loading, setLoading] = useState(true)

  const [addSubjectsOpen, setAddSubjectsOpen] = useState(false)
  const [addGroupsOpen, setAddGroupsOpen] = useState(false)
  const [addTeachersOpen, setAddTeachersOpen] = useState(false)

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [d, subjs, allGroups, deptTeachers] = await Promise.all([
        client.get<Department>(`/departments/${id}`).then(r => r.data),
        client.get<Subject[]>('/subjects', { params: { department_id: id } }).then(r => r.data),
        client.get<Group[]>('/groups').then(r => r.data),
        client.get<TeacherProfile[]>('/teachers', { params: { department_id: id } }).then(r => r.data),
      ])
      setDept(d)
      setSubjects(subjs.sort((a, b) => a.name.localeCompare(b.name)))
      setGroups(allGroups.filter(g => g.department_id === d.id).sort((a, b) => a.name.localeCompare(b.name)))
      setTeachers(deptTeachers.sort((a, b) => a.last_name.localeCompare(b.last_name)))
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const removeSubject = async (subject: Subject) => {
    await updateSubject(subject.id, { department_id: null })
    load()
  }

  const removeGroup = async (group: Group) => {
    await updateGroup(group.id, { department_id: null })
    load()
  }

  const removeTeacher = async (teacher: TeacherProfile) => {
    await setTeacherDepartment(teacher.id, null)
    load()
  }

  if (loading) return <Spinner />
  if (!dept) return <div className="p-8 text-slate-400">Кафедра не найдена</div>

  return (
    <div className="p-8 max-w-5xl">
      <nav className="flex items-center gap-1.5 text-sm text-slate-400 mb-6">
        <button onClick={() => navigate('/departments')} className="hover:text-blue-600 cursor-pointer transition-colors">
          Кафедры
        </button>
        <Chevron />
        <span className="text-slate-600 font-medium">{dept.name}</span>
      </nav>

      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">{dept.name}</h1>
            {dept.description && <p className="text-slate-400 text-sm mt-1">{dept.description}</p>}
          </div>
          {dept.code && (
            <span className="text-sm bg-blue-50 text-blue-600 font-mono px-3 py-1 rounded-lg shrink-0">{dept.code}</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-100">
          <Stat label="Дисциплин" value={subjects.length} />
          <Stat label="Групп" value={groups.length} />
          <Stat label="Преподавателей" value={teachers.length} />
        </div>
      </div>

      <div className="space-y-6">
        {/* Группы */}
        <Section
          title="Группы"
          subtitle={`${groups.length}`}
          onAdd={() => setAddGroupsOpen(true)}
          addLabel="Добавить группу"
        >
          {groups.length === 0 ? (
            <Empty text="Групп нет" />
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-slate-500 font-medium">Группа</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Набор</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Статус</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {groups.map(g => (
                    <tr key={g.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-3 cursor-pointer" onClick={() => navigate(`/groups/${g.id}`)}>
                        <span className="font-medium text-slate-800 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-emerald-600">{g.name[0]}</span>
                          </div>
                          {g.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 cursor-pointer" onClick={() => navigate(`/groups/${g.id}`)}>{g.year_start}</td>
                      <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/groups/${g.id}`)}>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          g.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>{g.is_active ? 'Активна' : 'Неактивна'}</span>
                      </td>
                      <td className="px-6 py-3">
                        <button
                          onClick={() => removeGroup(g)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Убрать из кафедры"
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
        </Section>

        {/* Дисциплины */}
        <Section
          title="Дисциплины"
          subtitle={`${subjects.length}`}
          onAdd={() => setAddSubjectsOpen(true)}
          addLabel="Добавить дисциплину"
        >
          {subjects.length === 0 ? (
            <Empty text="Дисциплин нет" />
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-slate-500 font-medium">Название</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Код</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">Часов</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {subjects.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 text-slate-800 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">{s.code ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{s.hours_total ?? '—'}</td>
                      <td className="px-6 py-3">
                        <button
                          onClick={() => removeSubject(s)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Убрать из кафедры"
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
        </Section>

        {/* Преподаватели */}
        <Section
          title="Преподаватели"
          subtitle={`${teachers.length}`}
          onAdd={() => setAddTeachersOpen(true)}
          addLabel="Добавить преподавателя"
        >
          {teachers.length === 0 ? (
            <Empty text="Преподавателей нет" />
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-slate-500 font-medium">ФИО</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Должность</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Телефон</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {teachers.map(t => (
                    <tr key={t.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-3 cursor-pointer" onClick={() => navigate(`/teachers/${t.id}`)}>
                        <span className="text-slate-800 font-medium flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-purple-600">{t.last_name[0]}</span>
                          </div>
                          {t.last_name} {t.first_name} {t.middle_name ?? ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 cursor-pointer" onClick={() => navigate(`/teachers/${t.id}`)}>{t.position ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500 cursor-pointer" onClick={() => navigate(`/teachers/${t.id}`)}>{t.phone ?? '—'}</td>
                      <td className="px-6 py-3">
                        <button
                          onClick={() => removeTeacher(t)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Убрать из кафедры"
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
        </Section>
      </div>

      {addSubjectsOpen && (
        <AddItemsModal
          title="Добавить дисциплины в кафедру"
          fetchItems={async () => {
            const all = await client.get<Subject[]>('/subjects').then(r => r.data)
            return all.filter(s => s.department_id !== dept.id).map(s => ({ id: s.id, label: s.name, sub: s.code ?? undefined }))
          }}
          onAdd={async (ids) => {
            await Promise.all(ids.map(id => updateSubject(id, { department_id: dept.id })))
          }}
          onClose={() => setAddSubjectsOpen(false)}
          onSave={() => { setAddSubjectsOpen(false); load() }}
        />
      )}

      {addGroupsOpen && (
        <AddItemsModal
          title="Добавить группы в кафедру"
          fetchItems={async () => {
            const all = await client.get<Group[]>('/groups').then(r => r.data)
            return all.filter(g => g.department_id !== dept.id).map(g => ({ id: g.id, label: g.name, sub: String(g.year_start) }))
          }}
          onAdd={async (ids) => {
            await Promise.all(ids.map(id => updateGroup(id, { department_id: dept.id })))
          }}
          onClose={() => setAddGroupsOpen(false)}
          onSave={() => { setAddGroupsOpen(false); load() }}
        />
      )}

      {addTeachersOpen && (
        <AddTeachersModal
          deptId={dept.id}
          onClose={() => setAddTeachersOpen(false)}
          onSave={() => { setAddTeachersOpen(false); load() }}
        />
      )}
    </div>
  )
}

function AddTeachersModal({ deptId, onClose, onSave }: {
  deptId: number
  onClose: () => void
  onSave: () => void
}) {
  const [items, setItems] = useState<(TeacherProfile & { currentDeptName?: string })[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getAllTeachers(), client.get<Department[]>('/departments').then(r => r.data)])
      .then(([teachers, depts]) => {
        const deptMap = Object.fromEntries(depts.map(d => [d.id, d.name]))
        setItems(
          teachers
            .filter(t => t.department_id !== deptId)
            .map(t => ({ ...t, currentDeptName: t.department_id ? deptMap[t.department_id] : undefined }))
        )
      })
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const filtered = items.filter(t =>
    `${t.last_name} ${t.first_name} ${t.middle_name ?? ''} ${t.position ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )

  const submit = async () => {
    if (selected.size === 0) return
    setSaving(true)
    try {
      await Promise.all([...selected].map(id => setTeacherDepartment(id, deptId)))
      onSave()
    } catch {
      setSaving(false)
    }
  }

  const hasTransfers = [...selected].some(id => items.find(t => t.id === id)?.currentDeptName)

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Добавить преподавателей в кафедру</h2>
      <input
        type="text"
        placeholder="Поиск по ФИО или должности..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 py-4 justify-center text-sm">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Загрузка...
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Нет доступных преподавателей</p>
      ) : (
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 border border-slate-100 rounded-lg mb-3">
          {filtered.map(t => (
            <label key={t.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(t.id)}
                onChange={() => toggle(t.id)}
                className="rounded border-slate-300 text-blue-600 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800">{t.last_name} {t.first_name} {t.middle_name ?? ''}</p>
                {t.position && <p className="text-xs text-slate-400">{t.position}</p>}
              </div>
              {t.currentDeptName
                ? <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded shrink-0">← {t.currentDeptName}</span>
                : <span className="text-xs text-slate-300 shrink-0">без кафедры</span>
              }
            </label>
          ))}
        </div>
      )}
      {hasTransfers && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
          Отмеченные преподаватели с указанием кафедры будут переведены из неё в текущую.
        </p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">Выбрано: {selected.size}</span>
        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={saving || selected.size === 0}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Добавление...' : `Добавить (${selected.size})`}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

interface PickItem { id: number; label: string; sub?: string }

function AddItemsModal({ title, fetchItems, onAdd, onClose, onSave }: {
  title: string
  fetchItems: () => Promise<PickItem[]>
  onAdd: (ids: number[]) => Promise<void>
  onClose: () => void
  onSave: () => void
}) {
  const [items, setItems] = useState<PickItem[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchItems().then(setItems).finally(() => setLoading(false))
  }, [])

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const filtered = items.filter(i => i.label.toLowerCase().includes(search.toLowerCase()))

  const submit = async () => {
    if (selected.size === 0) return
    setSaving(true)
    try {
      await onAdd([...selected])
      onSave()
    } catch {
      setSaving(false)
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-slate-800 mb-4">{title}</h2>
      <input
        type="text"
        placeholder="Поиск..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 py-4 justify-center text-sm">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Загрузка...
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Ничего не найдено</p>
      ) : (
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 border border-slate-100 rounded-lg mb-4">
          {filtered.map(item => (
            <label key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
                className="rounded border-slate-300 text-blue-600"
              />
              <span className="text-sm text-slate-800 flex-1">{item.label}</span>
              {item.sub && <span className="text-xs text-slate-400 font-mono">{item.sub}</span>}
            </label>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">Выбрано: {selected.size}</span>
        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={saving || selected.size === 0}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Добавление...' : `Добавить (${selected.size})`}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

function Section({ title, subtitle, children, onAdd, addLabel }: {
  title: string
  subtitle?: string
  children: React.ReactNode
  onAdd?: () => void
  addLabel?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold text-slate-700">{title}</h2>
          {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            + {addLabel}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
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
  return <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400 shadow-sm text-sm">{text}</div>
}
