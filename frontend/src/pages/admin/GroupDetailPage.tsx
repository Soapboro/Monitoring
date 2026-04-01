import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import type { StudentProfile } from '../../api/resources'

interface Group { id: number; name: string; year_start: number; is_active: boolean }

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [group, setGroup] = useState<Group | null>(null)
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      client.get<Group>(`/groups/${id}`).then(r => r.data),
      client.get<StudentProfile[]>('/students', { params: { group_id: id } }).then(r => r.data),
    ]).then(([g, s]) => {
      setGroup(g)
      setStudents(s)
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-4xl">
      {/* Хлебные крошки */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-400 mb-6">
        <button onClick={() => navigate('/groups')} className="hover:text-blue-600 transition-colors cursor-pointer">
          Группы
        </button>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-600 font-medium">{group?.name}</span>
      </nav>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">{group?.name}</h1>
          <p className="text-slate-400 text-sm mt-1">
            Год набора: {group?.year_start} · Студентов: {students.length}
          </p>
        </div>
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
          group?.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {group?.is_active ? 'Активна' : 'Неактивна'}
        </span>
      </div>

      {students.length === 0 ? (
        <Empty text="Студентов в группе нет" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Список студентов</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-6 py-3 text-slate-500 font-medium">#</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">ФИО</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">№ студ.</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {students.map((s, i) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/students/${s.id}`)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-3 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-blue-600">{s.last_name[0]}</span>
                    </div>
                    {s.last_name} {s.first_name} {s.middle_name ?? ''}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{s.student_num ?? '—'}</td>
                  <td className="px-6 py-3 text-right">
                    {s.is_active
                      ? <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Активен</span>
                      : <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Неактивен</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
