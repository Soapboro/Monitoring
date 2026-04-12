import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import type { TeachingAssignment, Subject, Group, StudentProfile } from '../../api/resources'
import { getTopStudents } from '../../api/analytics'
import type { TopStudent } from '../../api/analytics'

interface GroupRow {
  group: Group
  assignments: { assignment: TeachingAssignment; subject: Subject }[]
  students: StudentProfile[]
  topStudents: TopStudent[]
}

export default function MyGroupsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<GroupRow[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const teacher = await getMyTeacherProfile()
      const assignments: TeachingAssignment[] = await getAssignments(teacher.id)

      const groupIds = [...new Set(assignments.map(a => a.group_id))]
      const subjectIds = [...new Set(assignments.map(a => a.subject_id))]

      const [groups, subjects] = await Promise.all([
        Promise.all(groupIds.map(gid =>
          client.get<Group>(`/groups/${gid}`).then(r => r.data).catch(() => null)
        )),
        Promise.all(subjectIds.map(sid =>
          client.get<Subject>(`/subjects/${sid}`).then(r => r.data).catch(() => null)
        )),
      ])

      const groupMap: Record<number, Group> = {}
      for (const g of groups) if (g) groupMap[g.id] = g
      const subjectMap: Record<number, Subject> = {}
      for (const s of subjects) if (s) subjectMap[s.id] = s

      const result: GroupRow[] = await Promise.all(
        groupIds.map(async gid => {
          const grp = groupMap[gid]
          if (!grp) return null
          const grpAssignments = assignments
            .filter(a => a.group_id === gid)
            .map(a => ({ assignment: a, subject: subjectMap[a.subject_id] ?? { id: a.subject_id, name: `Предмет #${a.subject_id}`, code: null, hours_total: null, department_id: null } }))

          const [studs, top] = await Promise.all([
            client.get<StudentProfile[]>('/students', { params: { group_id: gid } }).then(r => r.data).catch(() => []),
            getTopStudents(gid, 5000).catch(() => []),
          ])
          return { group: grp, assignments: grpAssignments, students: studs, topStudents: top }
        })
      ).then(list => list.filter(Boolean) as GroupRow[])

      result.sort((a, b) => a.group.name.localeCompare(b.group.name))
      setRows(result)
      if (result.length > 0) setExpanded(result[0].group.id)
    }
    init().finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">Мои группы</h1>
      <p className="text-slate-400 text-sm mb-6">Группы, которым вы преподаёте · {rows.length} групп</p>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">
          Нет назначенных групп. Обратитесь к администратору.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map(({ group, assignments, students, topStudents }) => {
            const isOpen = expanded === group.id
            const sorted = [...topStudents].sort((a, b) => Number(b.avg_grade) - Number(a.avg_grade))

            return (
              <div key={group.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Заголовок группы */}
                <button
                  onClick={() => setExpanded(isOpen ? null : group.id)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-semibold text-slate-800">{group.name}</span>
                    <span className="text-xs text-slate-400">набор {group.year_start}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      group.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {group.is_active ? 'Активна' : 'Неактивна'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>{students.length} студ.</span>
                    <span>{assignments.length} предм.</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100">
                    {/* Предметы преподавателя в этой группе */}
                    <div className="px-6 py-3 border-b border-slate-50 bg-blue-50/40">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Ваши предметы</p>
                      <div className="flex flex-wrap gap-2">
                        {assignments.map(({ assignment, subject }) => (
                          <button
                            key={assignment.id}
                            onClick={() => navigate(`/assignments/${assignment.id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-blue-200 text-blue-700 text-xs font-medium rounded-full hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            {subject.name}
                            <span className="text-blue-400">·</span>
                            <span className="text-blue-500">{assignment.acad_year} / {assignment.semester} сем.</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Список студентов с баллами */}
                    {students.length === 0 ? (
                      <div className="px-6 py-6 text-center text-slate-400 text-sm">Студентов нет</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left px-6 py-2.5 text-slate-500 font-medium text-xs">#</th>
                            <th className="text-left px-4 py-2.5 text-slate-500 font-medium text-xs">Студент</th>
                            <th className="text-right px-6 py-2.5 text-slate-500 font-medium text-xs">Средний балл</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {students
                            .map(s => {
                              const top = sorted.find(t => t.id === s.id)
                              return { s, avg: top ? Number(top.avg_grade) : null }
                            })
                            .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1))
                            .map(({ s, avg }, i) => (
                              <tr
                                key={s.id}
                                onClick={() => navigate(`/students/${s.id}`)}
                                className="hover:bg-blue-50 cursor-pointer transition-colors"
                              >
                                <td className="px-6 py-2.5 text-slate-400">{i + 1}</td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                      <span className="text-xs font-semibold text-blue-600">{s.last_name[0]}</span>
                                    </div>
                                    <span className="text-slate-800 font-medium">{s.last_name} {s.first_name} {s.middle_name ?? ''}</span>
                                    {!s.is_active && (
                                      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">неактивен</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-2.5 text-right">
                                  {avg !== null ? (
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                      avg >= 4.5 ? 'bg-emerald-100 text-emerald-700' :
                                      avg >= 3.5 ? 'bg-blue-100 text-blue-700' :
                                      avg >= 2.5 ? 'bg-amber-100 text-amber-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>{avg.toFixed(2)}</span>
                                  ) : (
                                    <span className="text-slate-400 text-xs">нет оценок</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
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

function Spinner() {
  return (
    <div className="p-8 flex items-center gap-3 text-slate-400">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      Загрузка...
    </div>
  )
}
