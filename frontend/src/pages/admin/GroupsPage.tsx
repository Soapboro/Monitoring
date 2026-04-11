import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Group, Department } from '../../api/resources'
import { getGroups, getDepartments, createGroup, updateGroup, deleteGroup } from '../../api/resources'
import { Overlay, Field, ConfirmDelete, PencilIcon, TrashIcon } from '../../components/CrudHelpers'

export default function GroupsPage() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<Group[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; group?: Group } | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([getGroups(), getDepartments()])
      .then(([g, d]) => { setGroups(g); setDepartments(d) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async () => {
    if (deleteId === null) return
    await deleteGroup(deleteId)
    setDeleteId(null)
    load()
  }

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Учебные группы</h1>
          <p className="text-slate-400 text-sm">Всего: {groups.length} · Нажмите на группу для просмотра списка</p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          + Создать
        </button>
      </div>

      {groups.length === 0 ? <Empty text="Групп нет" /> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Название</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Год начала</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Статус</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {groups.map(g => (
                <tr key={g.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-6 py-3 cursor-pointer" onClick={() => navigate(`/groups/${g.id}`)}>
                    <span className="font-medium text-slate-800 flex items-center gap-2">
                      {g.name}
                      <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 cursor-pointer" onClick={() => navigate(`/groups/${g.id}`)}>
                    {g.year_start}
                  </td>
                  <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/groups/${g.id}`)}>
                    {g.is_active
                      ? <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Активна</span>
                      : <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Неактивна</span>
                    }
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setModal({ mode: 'edit', group: g })}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                        title="Редактировать"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        onClick={() => setDeleteId(g.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Удалить"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <GroupModal
          mode={modal.mode}
          group={modal.group}
          departments={departments}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load() }}
        />
      )}

      {deleteId !== null && (
        <ConfirmDelete
          text="Удалить группу? Это действие необратимо."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}

function GroupModal({ mode, group, departments, onClose, onSave }: {
  mode: 'create' | 'edit'
  group?: Group
  departments: Department[]
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(group?.name ?? '')
  const [yearStart, setYearStart] = useState(group?.year_start?.toString() ?? new Date().getFullYear().toString())
  const [departmentId, setDepartmentId] = useState(group?.department_id?.toString() ?? '')
  const [isActive, setIsActive] = useState(group?.is_active ?? true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) { setError('Название обязательно'); return }
    if (!yearStart || isNaN(parseInt(yearStart))) { setError('Укажите год начала'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: name.trim(),
        year_start: parseInt(yearStart),
        department_id: departmentId ? parseInt(departmentId) : undefined,
        is_active: isActive,
      }
      if (mode === 'create') {
        await createGroup(payload)
      } else {
        await updateGroup(group!.id, payload)
      }
      onSave()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Ошибка сохранения')
      setSaving(false)
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-slate-800 mb-5">
        {mode === 'create' ? 'Новая группа' : 'Редактировать группу'}
      </h2>
      <Field label="Название">
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </Field>
      <Field label="Год начала обучения">
        <input type="number" min="2000" max="2100" value={yearStart} onChange={e => setYearStart(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </Field>
      <Field label="Кафедра (необязательно)">
        <select value={departmentId} onChange={e => setDepartmentId(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">— не указана —</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      <Field label="Статус">
        <select value={isActive ? 'true' : 'false'} onChange={e => setIsActive(e.target.value === 'true')}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="true">Активна</option>
          <option value="false">Неактивна</option>
        </select>
      </Field>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
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
