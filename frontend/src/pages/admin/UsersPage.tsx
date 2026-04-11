import { useEffect, useState } from 'react'
import client from '../../api/client'
import { createUser, updateUser, deleteUser } from '../../api/resources'
import type { UserMe } from '../../api/auth'
import { Overlay, Field, ConfirmDelete, PencilIcon, TrashIcon } from '../../components/CrudHelpers'

const ROLE_LABELS: Record<string, string> = { admin: 'Администратор', teacher: 'Преподаватель', student: 'Студент' }

export default function UsersPage() {
  const [users, setUsers] = useState<UserMe[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; user?: UserMe } | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    client.get<UserMe[]>('/users').then(r => setUsers(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    ROLE_LABELS[u.role].toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async () => {
    if (deleteId === null) return
    await deleteUser(deleteId)
    setDeleteId(null)
    load()
  }

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Пользователи</h1>
          <p className="text-slate-400 text-sm">Всего: {users.length}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Поиск по email или роли..."
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
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Роль</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Статус</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-800">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      u.role === 'teacher' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active
                      ? <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Активен</span>
                      : <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">Отключён</span>
                    }
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setModal({ mode: 'edit', user: u })}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Редактировать"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        onClick={() => setDeleteId(u.id)}
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
        <UserModal
          mode={modal.mode}
          user={modal.user}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load() }}
        />
      )}

      {deleteId !== null && (
        <ConfirmDelete
          text="Удалить пользователя? Это действие необратимо."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}

function UserModal({ mode, user, onClose, onSave }: {
  mode: 'create' | 'edit'
  user?: UserMe
  onClose: () => void
  onSave: () => void
}) {
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(user?.role ?? 'student')
  const [isActive, setIsActive] = useState(user?.is_active ?? true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!email) { setError('Email обязателен'); return }
    if (mode === 'create' && !password) { setError('Пароль обязателен'); return }
    setSaving(true)
    setError('')
    try {
      if (mode === 'create') {
        await createUser({ email, password, role })
      } else {
        await updateUser(user!.id, { email, role, is_active: isActive })
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
        {mode === 'create' ? 'Новый пользователь' : 'Редактировать пользователя'}
      </h2>
      <Field label="Email">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </Field>
      {mode === 'create' && (
        <Field label="Пароль">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
      )}
      <Field label="Роль">
        <select value={role} onChange={e => setRole(e.target.value as UserMe['role'])}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="admin">Администратор</option>
          <option value="teacher">Преподаватель</option>
          <option value="student">Студент</option>
        </select>
      </Field>
      {mode === 'edit' && (
        <Field label="Статус">
          <select value={isActive ? 'true' : 'false'} onChange={e => setIsActive(e.target.value === 'true')}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="true">Активен</option>
            <option value="false">Отключён</option>
          </select>
        </Field>
      )}
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
