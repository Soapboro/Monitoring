import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import type { TeacherProfile, TeachingAssignment, Subject } from '../../api/resources'

interface Group { id: number; name: string; year_start: number }
interface Department { id: number; name: string }

interface GroupAssignments {
  group: Group
  items: { assignment: TeachingAssignment; subject: Subject; deptName: string | null }[]
}

export default function TeacherDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [teacher, setTeacher] = useState<TeacherProfile | null>(null)
  const [groups, setGroups] = useState<GroupAssignments[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    async function init() {
      try {
        const [t, assignments] = await Promise.all([
          client.get<TeacherProfile>(`/teachers/${id}`).then(r => r.data),
          client.get<TeachingAssignment[]>('/teaching-assignments', { params: { teacher_id: id } }).then(r => r.data),
        ])
        setTeacher(t)

        // Resolve subjects, groups, departments
        const subjectIds = [...new Set(assignments.map(a => a.subject_id))]
        const groupIds = [...new Set(assignments.map(a => a.group_id))]

        const [subjects, groups] = await Promise.all([
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
        for (const g of groups) if (g) groupMap[g.id] = g

        // Resolve department names (unique dept ids from subjects)
        const deptIds = [...new Set(subjects.map(s => s?.department_id).filter(Boolean) as number[])]
        const deptMap: Record<number, string> = {}
        await Promise.all(deptIds.map(did =>
          client.get<Department>(`/departments/${did}`).then(r => { deptMap[did] = r.data.name }).catch(() => {})
        ))

        // Group assignments by group_id
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
        if (result.length > 0) setExpanded(result[0].group.id)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [id])

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

      {/* Назначения по группам */}
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-base font-semibold text-slate-700">Преподаваемые предметы</h2>
        <span className="text-xs text-slate-400">{groups.length} групп</span>
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
                          <th className="w-10" />
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
                            <td className="px-4 py-3 text-slate-500">{subject.control_form ?? '—'}</td>
                            <td className="px-4 py-3 text-right text-slate-400">
                              <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
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
    </div>
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
