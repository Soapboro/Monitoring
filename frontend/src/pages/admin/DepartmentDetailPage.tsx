import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import type { Subject, TeacherProfile, TeachingAssignment } from '../../api/resources'

interface Department { id: number; name: string; code: string | null; description: string | null }
interface Group { id: number; name: string; department_id: number | null; is_active: boolean; year_start: number }

export default function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [dept, setDept] = useState<Department | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [teachers, setTeachers] = useState<TeacherProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    async function init() {
      try {
        const [d, subjs, allGroups] = await Promise.all([
          client.get<Department>(`/departments/${id}`).then(r => r.data),
          client.get<Subject[]>('/subjects', { params: { department_id: id } }).then(r => r.data),
          client.get<Group[]>('/groups').then(r => r.data),
        ])
        setDept(d)
        setSubjects(subjs.sort((a, b) => a.name.localeCompare(b.name)))
        setGroups(allGroups.filter(g => g.department_id === d.id).sort((a, b) => a.name.localeCompare(b.name)))

        // Find teachers via assignments for each subject
        const assignPromises = subjs.map(s =>
          client.get<TeachingAssignment[]>('/teaching-assignments', { params: { subject_id: s.id } })
            .then(r => r.data).catch(() => [] as TeachingAssignment[])
        )
        const allAssignments = (await Promise.all(assignPromises)).flat()
        const teacherIds = [...new Set(allAssignments.map(a => a.teacher_id))]

        const teacherList = (await Promise.all(
          teacherIds.map(tid =>
            client.get<TeacherProfile>(`/teachers/${tid}`).then(r => r.data).catch(() => null)
          )
        )).filter(Boolean) as TeacherProfile[]

        setTeachers(teacherList.sort((a, b) => a.last_name.localeCompare(b.last_name)))
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [id])

  if (loading) return <Spinner />
  if (!dept) return <div className="p-8 text-slate-400">Кафедра не найдена</div>

  return (
    <div className="p-8 max-w-5xl">
      {/* Хлебные крошки */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-400 mb-6">
        <button onClick={() => navigate('/departments')} className="hover:text-blue-600 cursor-pointer transition-colors">
          Кафедры
        </button>
        <Chevron />
        <span className="text-slate-600 font-medium">{dept.name}</span>
      </nav>

      {/* Шапка */}
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
        <Section title="Группы" subtitle={`${groups.length}`}>
          {groups.length === 0 ? (
            <Empty text="Групп нет" />
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-slate-500 font-medium">Группа</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Набор</th>
                    <th className="text-right px-6 py-3 text-slate-500 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {groups.map(g => (
                    <tr
                      key={g.id}
                      onClick={() => navigate(`/groups/${g.id}`)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-3 text-slate-800 font-medium flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-emerald-600">{g.name[0]}</span>
                        </div>
                        {g.name}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{g.year_start}</td>
                      <td className="px-6 py-3 text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          g.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>{g.is_active ? 'Активна' : 'Неактивна'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Дисциплины */}
        <Section title="Дисциплины" subtitle={`${subjects.length}`}>
          {subjects.length === 0 ? (
            <Empty text="Дисциплин нет" />
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-slate-500 font-medium">Название</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Код</th>
                    <th className="text-right px-6 py-3 text-slate-500 font-medium">Часов</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {subjects.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 text-slate-800 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">{s.code ?? '—'}</td>
                      <td className="px-6 py-3 text-right text-slate-500">{s.hours_total ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Преподаватели */}
        <Section title="Преподаватели" subtitle={`${teachers.length}`}>
          {teachers.length === 0 ? (
            <Empty text="Преподавателей нет" />
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-slate-500 font-medium">ФИО</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Должность</th>
                    <th className="text-right px-6 py-3 text-slate-500 font-medium">Телефон</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {teachers.map(t => (
                    <tr
                      key={t.id}
                      onClick={() => navigate(`/teachers/${t.id}`)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-3 text-slate-800 font-medium flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-purple-600">{t.last_name[0]}</span>
                        </div>
                        {t.last_name} {t.first_name} {t.middle_name ?? ''}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{t.position ?? '—'}</td>
                      <td className="px-6 py-3 text-right text-slate-500">{t.phone ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-base font-semibold text-slate-700">{title}</h2>
        {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
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
