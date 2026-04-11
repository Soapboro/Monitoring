import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import type { Subject, Department } from '../../api/resources'
import { createDepartment, updateDepartment, deleteDepartment } from '../../api/resources'
import { Overlay, Field, ConfirmDelete, PencilIcon, TrashIcon } from '../../components/CrudHelpers'

interface Group { id: number; name: string; department_id: number | null }

interface DeptRow extends Department {
  subjectCount: number
  groupCount: number
}

export default function DepartmentsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<DeptRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; dept?: Department } | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    const [depts, subjects, groups] = await Promise.all([
      client.get<Department[]>('/departments').then(r => r.data),
      client.get<Subject[]>('/subjects').then(r => r.data),
      client.get<Group[]>('/groups').then(r => r.data),
    ])
    const subjectCount: Record<number, number> = {}
    for (const s of subjects) if (s.department_id) subjectCount[s.department_id] = (subjectCount[s.department_id] ?? 0) + 1
    const groupCount: Record<number, number> = {}
    for (const g of groups) if (g.department_id) groupCount[g.department_id] = (groupCount[g.department_id] ?? 0) + 1
    setRows(depts.map(d => ({ ...d, subjectCount: subjectCount[d.id] ?? 0, groupCount: groupCount[d.id] ?? 0 })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = rows.filter(d =>
    `${d.name} ${d.code ?? ''} ${d.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async () => {
    if (deleteId === null) return
    await deleteDepartment(deleteId)
    setDeleteId(null)
    load()
  }

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Кафедры</h1>
          <p className="text-slate-400 text-sm">Всего: {rows.length}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Поиск по названию или коду..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            + Создать
          </button>
        </div>
      </div>

      {filtered.length === 0 ? <Empty text="Ничего не найдено" /> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Кафедра</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Код</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Дисциплин</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Групп</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(d => (
                <tr key={d.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-6 py-3 cursor-pointer" onClick={() => navigate(`/departments/${d.id}`)}>
                    <p className="font-medium text-slate-800">{d.name}</p>
                    {d.description && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{d.description}</p>}
                  </td>
                  <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/departments/${d.id}`)}>
                    {d.code
                      ? <span className="text-xs bg-blue-50 text-blue-600 font-mono px-2 py-0.5 rounded">{d.code}</span>
                      : <span className="text-slate-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right cursor-pointer" onClick={() => navigate(`/departments/${d.id}`)}>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      d.subjectCount > 0 ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'
                    }`}>{d.subjectCount || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right cursor-pointer" onClick={() => navigate(`/departments/${d.id}`)}>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      d.groupCount > 0 ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'
                    }`}>{d.groupCount || '—'}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setModal({ mode: 'edit', dept: d })}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                        title="Редактировать"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        onClick={() => setDeleteId(d.id)}
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
        <DepartmentModal
          mode={modal.mode}
          dept={modal.dept}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load() }}
        />
      )}

      {deleteId !== null && (
        <ConfirmDelete
          text="Удалить кафедру? Это действие необратимо."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}

function DepartmentModal({ mode, dept, onClose, onSave }: {
  mode: 'create' | 'edit'
  dept?: Department
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(dept?.name ?? '')
  const [code, setCode] = useState(dept?.code ?? '')
  const [description, setDescription] = useState(dept?.description ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) { setError('Название обязательно'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || undefined,
        description: description.trim() || undefined,
      }
      if (mode === 'create') {
        await createDepartment(payload)
      } else {
        await updateDepartment(dept!.id, payload)
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
        {mode === 'create' ? 'Новая кафедра' : 'Редактировать кафедру'}
      </h2>
      <Field label="Название">
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </Field>
      <Field label="Код (необязательно)">
        <input value={code} onChange={e => setCode(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </Field>
      <Field label="Описание (необязательно)">
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
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
