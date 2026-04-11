import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import type { StudentProfile, Group } from '../../api/resources'
import { getAllStudents, transferStudent, getGroups } from '../../api/resources'
import { Overlay } from '../../components/CrudHelpers'

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [group, setGroup] = useState<Group | null>(null)
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [transferTarget, setTransferTarget] = useState<StudentProfile | null>(null)

  const load = () => {
    if (!id) return
    setLoading(true)
    Promise.all([
      client.get<Group>(`/groups/${id}`).then(r => r.data),
      client.get<StudentProfile[]>('/students', { params: { group_id: id } }).then(r => r.data),
    ]).then(([g, s]) => {
      setGroup(g)
      setStudents(s)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  if (loading) return <Spinner />
  if (!group) return <div className="p-8 text-slate-400">Группа не найдена</div>

  return (
    <div className="p-8 max-w-4xl">
      <nav className="flex items-center gap-1.5 text-sm text-slate-400 mb-6">
        <button onClick={() => navigate('/groups')} className="hover:text-blue-600 transition-colors cursor-pointer">
          Группы
        </button>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-600 font-medium">{group.name}</span>
      </nav>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">{group.name}</h1>
          <p className="text-slate-400 text-sm mt-1">
            Год набора: {group.year_start} · Студентов: {students.length}
          </p>
        </div>
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
          group.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {group.is_active ? 'Активна' : 'Неактивна'}
        </span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-base font-semibold text-slate-700">Список студентов</p>
        <button
          onClick={() => setAddOpen(true)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          + Добавить студента
        </button>
      </div>

      {students.length === 0 ? (
        <Empty text="Студентов в группе нет" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">#</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">ФИО</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">№ студ.</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Статус</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {students.map((s, i) => (
                <tr key={s.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-6 py-3 text-slate-400 cursor-pointer" onClick={() => navigate(`/students/${s.id}`)}>{i + 1}</td>
                  <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/students/${s.id}`)}>
                    <span className="text-slate-800 font-medium flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-blue-600">{s.last_name[0]}</span>
                      </div>
                      {s.last_name} {s.first_name} {s.middle_name ?? ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 cursor-pointer" onClick={() => navigate(`/students/${s.id}`)}>{s.student_num ?? '—'}</td>
                  <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/students/${s.id}`)}>
                    {s.is_active
                      ? <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Активен</span>
                      : <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Неактивен</span>
                    }
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => setTransferTarget(s)}
                      className="text-xs text-slate-400 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                      title="Перевести в другую группу"
                    >
                      Перевести
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <AddStudentsModal
          currentGroupId={group.id}
          onClose={() => setAddOpen(false)}
          onSave={() => { setAddOpen(false); load() }}
        />
      )}

      {transferTarget && (
        <TransferStudentModal
          student={transferTarget}
          currentGroupId={group.id}
          onClose={() => setTransferTarget(null)}
          onSave={() => { setTransferTarget(null); load() }}
        />
      )}
    </div>
  )
}

function AddStudentsModal({ currentGroupId, onClose, onSave }: {
  currentGroupId: number
  onClose: () => void
  onSave: () => void
}) {
  const [items, setItems] = useState<StudentProfile[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAllStudents()
      .then(all => setItems(all.filter(s => s.group_id !== currentGroupId)))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const filtered = items.filter(s =>
    `${s.last_name} ${s.first_name} ${s.middle_name ?? ''} ${s.student_num ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )

  const submit = async () => {
    if (selected.size === 0) return
    setSaving(true)
    try {
      await Promise.all([...selected].map(id => transferStudent(id, currentGroupId)))
      onSave()
    } catch {
      setSaving(false)
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Добавить студентов в группу</h2>
      <input
        type="text"
        placeholder="Поиск по ФИО или номеру..."
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
        <p className="text-sm text-slate-400 text-center py-4">Нет доступных студентов</p>
      ) : (
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 border border-slate-100 rounded-lg mb-4">
          {filtered.map(s => (
            <label key={s.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() => toggle(s.id)}
                className="rounded border-slate-300 text-blue-600"
              />
              <span className="text-sm text-slate-800 flex-1">{s.last_name} {s.first_name} {s.middle_name ?? ''}</span>
              {s.student_num && <span className="text-xs text-slate-400 font-mono">{s.student_num}</span>}
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

function TransferStudentModal({ student, currentGroupId, onClose, onSave }: {
  student: StudentProfile
  currentGroupId: number
  onClose: () => void
  onSave: () => void
}) {
  const [groups, setGroups] = useState<Group[]>([])
  const [targetId, setTargetId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getGroups()
      .then(all => setGroups(all.filter(g => g.id !== currentGroupId)))
      .finally(() => setLoading(false))
  }, [])

  const submit = async () => {
    if (!targetId) { setError('Выберите группу'); return }
    setSaving(true)
    try {
      await transferStudent(student.id, parseInt(targetId))
      onSave()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Ошибка')
      setSaving(false)
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-slate-800 mb-1">Перевести студента</h2>
      <p className="text-sm text-slate-400 mb-5">{student.last_name} {student.first_name} {student.middle_name ?? ''}</p>
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 py-4 justify-center text-sm">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Новая группа</label>
          <select
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— выберите группу —</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name} ({g.year_start})</option>
            ))}
          </select>
        </div>
      )}
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
          Отмена
        </button>
        <button
          onClick={submit}
          disabled={saving || !targetId}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Перевод...' : 'Перевести'}
        </button>
      </div>
    </Overlay>
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
  return <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">{text}</div>
}
