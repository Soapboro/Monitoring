import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { getSubjects, getMyTeacherProfile, getAssignments } from '../../api/resources'
import type { Subject } from '../../api/resources'

interface TestOut {
  id: number
  title: string
  subject_id: number
  status: 'draft' | 'published' | 'archived'
  time_limit_minutes: number | null
  attempts_allowed: number
  passing_score_pct: number
  created_at: string
}

const STATUS = {
  draft:     { label: 'Черновик',  cls: 'bg-slate-100 text-slate-500' },
  published: { label: 'Опубликован', cls: 'bg-emerald-100 text-emerald-700' },
  archived:  { label: 'Архив',    cls: 'bg-amber-100 text-amber-700' },
}

export default function TestsPage() {
  const navigate = useNavigate()
  const [tests, setTests] = useState<TestOut[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  // Только предметы, которые ведёт текущий преподаватель
  const [mySubjects, setMySubjects] = useState<Subject[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [pickedSubjectId, setPickedSubjectId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    Promise.all([
      client.get<TestOut[]>('/tests').then(r => r.data),
      getSubjects(),
      getMyTeacherProfile()
        .then(t => getAssignments(t.id))
        .then(asgns => {
          const ids = [...new Set(asgns.map(a => a.subject_id))]
          return ids
        })
        .catch(() => [] as number[]),
    ]).then(([t, allSubs, mySubjectIds]) => {
      setTests(t)
      setSubjects(allSubs)
      const mine = allSubs.filter(s => mySubjectIds.includes(s.id))
      setMySubjects(mine)
      if (mine.length > 0) setPickedSubjectId(mine[0].id)
    }).finally(() => setLoading(false))
  }, [])

  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s.name]))

  const filtered = tests.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (subjectMap[t.subject_id] ?? '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate() {
    if (!mySubjects.length) return alert('У вас нет назначенных предметов')
    setShowPicker(true)
  }

  async function confirmCreate() {
    if (!pickedSubjectId) return
    setCreating(true)
    try {
      const { data } = await client.post<TestOut>('/tests', {
        subject_id: pickedSubjectId,
        title: 'Новый тест',
        passing_score_pct: 60,
        attempts_allowed: 1,
      })
      navigate(`/tests/${data.id}`)
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Ошибка создания теста')
    } finally {
      setCreating(false)
      setShowPicker(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-5xl">
      {/* Модал выбора предмета */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-1">Выберите предмет</h2>
            <p className="text-sm text-slate-400 mb-4">Тест будет создан по выбранному предмету</p>
            <select
              value={pickedSubjectId ?? ''}
              onChange={e => setPickedSubjectId(Number(e.target.value))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {mySubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowPicker(false)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
                Отмена
              </button>
              <button onClick={confirmCreate} disabled={creating || !pickedSubjectId}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {creating ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Тесты</h1>
          <p className="text-slate-400 text-sm">Всего: {tests.length}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text" placeholder="Поиск..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCreate} disabled={creating}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            + Создать тест
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">
          {tests.length === 0 ? 'Тестов пока нет. Создайте первый!' : 'Ничего не найдено'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Название</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Предмет</th>
                <th className="text-center px-4 py-3 text-slate-500 font-medium">Статус</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Время</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Попытки</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Порог</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(t => {
                const st = STATUS[t.status]
                return (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/tests/${t.id}`)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3 font-medium text-slate-800">{t.title}</td>
                    <td className="px-4 py-3 text-slate-500">{subjectMap[t.subject_id] ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {t.time_limit_minutes ? `${t.time_limit_minutes} мин` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">{t.attempts_allowed}</td>
                    <td className="px-6 py-3 text-right text-slate-500">{t.passing_score_pct}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return <div className="p-8 flex items-center gap-3 text-slate-400"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />Загрузка...</div>
}
