import { useEffect, useState } from 'react'
import type { Subject, Department } from '../../api/resources'
import { getSubjects, getDepartments, createSubject, updateSubject, deleteSubject } from '../../api/resources'
import { Overlay, Field, ConfirmDelete, PencilIcon, TrashIcon } from '../../components/CrudHelpers'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; subject?: Subject } | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([getSubjects(), getDepartments()])
      .then(([s, d]) => { setSubjects(s); setDepartments(d) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const deptName = (id: number | null) => departments.find(d => d.id === id)?.name ?? '—'

  const filtered = subjects.filter(s =>
    `${s.name} ${s.code ?? ''} ${deptName(s.department_id)}`.toLowerCase().includes(search.toLowerCase())
  )

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, (s, key) => {
    if (key === 'name') return s.name
    if (key === 'code') return s.code ?? ''
    if (key === 'hours') return s.hours_total ?? -1
    if (key === 'dept') return deptName(s.department_id)
    return ''
  })

  const handleDelete = async () => {
    if (deleteId === null) return
    await deleteSubject(deleteId)
    setDeleteId(null)
    load()
  }

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Дисциплины</h1>
          <p className="text-slate-400 text-sm">Всего: {subjects.length}</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="text" placeholder="Поиск по названию или кафедре..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => setModal({ mode: 'create' })}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
            + Создать
          </button>
        </div>
      </div>

      {sorted.length === 0 ? <Empty text="Ничего не найдено" /> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <SortableHeader label="Название" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="px-6" />
                <SortableHeader label="Код" sortKey="code" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Кафедра" sortKey="dept" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Часов" sortKey="hours" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-800 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{s.code ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{deptName(s.department_id)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{s.hours_total ?? '—'}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setModal({ mode: 'edit', subject: s })} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Редактировать"><PencilIcon /></button>
                      <button onClick={() => setDeleteId(s.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Удалить"><TrashIcon /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <SubjectModal mode={modal.mode} subject={modal.subject} departments={departments} onClose={() => setModal(null)} onSave={() => { setModal(null); load() }} />}
      {deleteId !== null && <ConfirmDelete text="Удалить дисциплину? Это действие необратимо." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  )
}

function SubjectModal({ mode, subject, departments, onClose, onSave }: {
  mode: 'create' | 'edit'; subject?: Subject; departments: Department[]; onClose: () => void; onSave: () => void
}) {
  const [name, setName] = useState(subject?.name ?? '')
  const [code, setCode] = useState(subject?.code ?? '')
  const [hoursTotal, setHoursTotal] = useState(subject?.hours_total?.toString() ?? '')
  const [departmentId, setDepartmentId] = useState(subject?.department_id?.toString() ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) { setError('Название обязательно'); return }
    setSaving(true); setError('')
    try {
      const payload = { name: name.trim(), code: code.trim() || undefined, hours_total: hoursTotal ? parseInt(hoursTotal) : undefined, department_id: departmentId ? parseInt(departmentId) : undefined }
      if (mode === 'create') await createSubject(payload)
      else await updateSubject(subject!.id, payload)
      onSave()
    } catch (e: any) { setError(e?.response?.data?.detail ?? 'Ошибка сохранения'); setSaving(false) }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-slate-800 mb-5">{mode === 'create' ? 'Новая дисциплина' : 'Редактировать дисциплину'}</h2>
      <Field label="Название"><input value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></Field>
      <Field label="Код (необязательно)"><input value={code} onChange={e => setCode(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" /></Field>
      <Field label="Количество часов (необязательно)"><input type="number" min="0" value={hoursTotal} onChange={e => setHoursTotal(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></Field>
      <Field label="Кафедра (необязательно)">
        <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">— не указана —</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="flex justify-end gap-3 mt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">Отмена</button>
        <button onClick={submit} disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">{saving ? 'Сохранение...' : 'Сохранить'}</button>
      </div>
    </Overlay>
  )
}

function Spinner() {
  return <div className="p-8 flex items-center gap-3 text-slate-400"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />Загрузка...</div>
}
function Empty({ text }: { text: string }) {
  return <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">{text}</div>
}
