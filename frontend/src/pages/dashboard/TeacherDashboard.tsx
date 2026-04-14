import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import {
  getGroupSummary, getGroupAttendanceBySubject, getTopStudents,
} from '../../api/analytics'
import type { GroupSummaryRow, AttendanceBySubjectRow, TopStudent } from '../../api/analytics'
import client from '../../api/client'

type SortDir = 'desc' | 'asc'

interface GroupData {
  summary: GroupSummaryRow[]
  attendance: AttendanceBySubjectRow[]
  students: TopStudent[]
  avgGrade: number | null
  avgAttendance: number | null
}

const BAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

export default function TeacherDashboard() {
  const navigate = useNavigate()
  const [teacherName, setTeacherName] = useState('')
  const [groupIds, setGroupIds] = useState<number[]>([])
  const [groupNames, setGroupNames] = useState<Record<number, string>>({})
  const [teacherSubjectNames, setTeacherSubjectNames] = useState<Set<string>>(new Set())
  const [subjectLabel, setSubjectLabel] = useState('')   // "БД" или "моим дисциплинам"
  const [groupData, setGroupData] = useState<Record<number, GroupData>>({})
  const [allStudents, setAllStudents] = useState<TopStudent[]>([])
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const teacher = await getMyTeacherProfile()
        setTeacherName(`${teacher.last_name} ${teacher.first_name}`)

        const [assignments, allGroups, allSubjects] = await Promise.all([
          getAssignments(teacher.id),
          client.get<{ id: number; name: string }[]>('/api/groups').then(r => r.data),
          client.get<{ id: number; name: string }[]>('/api/subjects').then(r => r.data),
        ])

        const groupNameMap: Record<number, string> = {}
        for (const g of allGroups) groupNameMap[g.id] = g.name
        setGroupNames(groupNameMap)

        const subjectNameMap: Record<number, string> = {}
        for (const s of allSubjects) subjectNameMap[s.id] = s.name

        const ids = [...new Set(assignments.map(a => a.group_id))]
        setGroupIds(ids)

        const mySubjectIds = [...new Set(assignments.map(a => a.subject_id))]
        const mySubjectNames = new Set(
          mySubjectIds.map(id => subjectNameMap[id]).filter(Boolean)
        )
        setTeacherSubjectNames(mySubjectNames)

        // Метка для карточек: "по БД" или "по моим дисциплинам"
        const subjectArr = Array.from(mySubjectNames)
        setSubjectLabel(
          subjectArr.length === 1
            ? `по ${subjectArr[0]}`
            : 'по моим дисциплинам'
        )

        if (ids.length === 0) return

        const results = await Promise.all(
          ids.map(gid => Promise.all([
            getGroupSummary(gid),
            getGroupAttendanceBySubject(gid),
            getTopStudents(gid, 1000),
          ]))
        )

        const data: Record<number, GroupData> = {}
        const combinedStudents: TopStudent[] = []

        for (let i = 0; i < ids.length; i++) {
          const [summary, att, students] = results[i]
          const filteredSummary = summary.filter(r => mySubjectNames.has(r.subject))
          const filteredAtt = att.filter(r => mySubjectNames.has(r.subject))

          const avgGrade = filteredSummary.length > 0
            ? filteredSummary.reduce((s, r) => s + Number(r.avg_grade), 0) / filteredSummary.length
            : null

          const avgAtt = filteredAtt.length > 0
            ? Math.round(filteredAtt.reduce((s, r) => s + (r.rate_pct ?? 0), 0) / filteredAtt.length)
            : null

          data[ids[i]] = {
            summary: filteredSummary,
            attendance: filteredAtt,
            students,
            avgGrade,
            avgAttendance: avgAtt,
          }
          combinedStudents.push(...students)
        }

        setGroupData(data)

        // Дедупликация студентов (берём лучший балл)
        const byId = new Map<number, TopStudent>()
        for (const s of combinedStudents) {
          const ex = byId.get(s.id)
          if (!ex || Number(s.avg_grade) > Number(ex.avg_grade)) byId.set(s.id, s)
        }
        setAllStudents(Array.from(byId.values()))
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  if (loading) return <Spinner />

  // Данные для графиков: одна запись на группу
  const gradeChartData = groupIds
    .map(id => ({
      name: groupNames[id] ?? `Группа ${id}`,
      avg: groupData[id]?.avgGrade != null ? Number(groupData[id].avgGrade!.toFixed(2)) : 0,
      hasData: groupData[id]?.avgGrade != null,
    }))
    .filter(d => d.hasData)

  const attChartData = groupIds
    .map(id => ({
      name: groupNames[id] ?? `Группа ${id}`,
      rate: groupData[id]?.avgAttendance ?? 0,
      hasData: groupData[id]?.avgAttendance != null,
    }))
    .filter(d => d.hasData)

  const sortedStudents = [...allStudents].sort((a, b) =>
    sortDir === 'desc'
      ? Number(b.avg_grade) - Number(a.avg_grade)
      : Number(a.avg_grade) - Number(b.avg_grade)
  )

  return (
    <div className="p-8 max-w-6xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Главная</h1>
        <p className="text-slate-400 text-sm mt-1">{teacherName}</p>
      </div>

      {groupIds.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400 shadow-sm">
          Нет назначенных групп. Обратитесь к администратору.
        </div>
      ) : (
        <>
          {/* Stat cards: одна пара на группу */}
          <div className={`grid gap-4 ${
            groupIds.length === 1 ? 'grid-cols-3' :
            groupIds.length === 2 ? 'grid-cols-2' :
            'grid-cols-3'
          }`}>
            {/* Количество групп */}
            <button
              onClick={() => navigate('/my-groups')}
              className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-left
                         hover:shadow-md hover:border-slate-200 transition-all cursor-pointer"
            >
              <p className="text-sm text-slate-500 mb-1">Моих групп</p>
              <p className="text-3xl font-bold text-slate-800">{groupIds.length}</p>
            </button>

            {/* По одной карточке на группу для среднего балла */}
            {groupIds.map(id => {
              const d = groupData[id]
              return (
                <button
                  key={`grade-${id}`}
                  onClick={() => navigate('/grades')}
                  className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-left
                             hover:shadow-md hover:border-slate-200 transition-all cursor-pointer"
                >
                  <p className="text-sm text-slate-500 mb-1">Средний балл {subjectLabel}</p>
                  <p className="text-3xl font-bold text-slate-800">
                    {d?.avgGrade != null ? d.avgGrade.toFixed(2) : '—'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{groupNames[id] ?? `Группа ${id}`}</p>
                </button>
              )
            })}

            {/* По одной карточке на группу для посещаемости */}
            {groupIds.map(id => {
              const d = groupData[id]
              return (
                <button
                  key={`att-${id}`}
                  onClick={() => navigate('/attendance')}
                  className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-left
                             hover:shadow-md hover:border-slate-200 transition-all cursor-pointer"
                >
                  <p className="text-sm text-slate-500 mb-1">Средняя посещаемость {subjectLabel}</p>
                  <p className="text-3xl font-bold text-slate-800">
                    {d?.avgAttendance != null ? `${d.avgAttendance}%` : '—'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{groupNames[id] ?? `Группа ${id}`}</p>
                </button>
              )
            })}
          </div>

          {/* Charts: сравнение групп */}
          <div className="grid grid-cols-2 gap-6">
            {gradeChartData.length > 0 && (
              <div
                onClick={() => navigate('/grades')}
                className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm cursor-pointer hover:shadow-md hover:border-slate-200 transition-all"
              >
                <h2 className="text-base font-semibold text-slate-700 mb-1">Средний балл по группам</h2>
                <p className="text-xs text-slate-400 mb-4">{subjectLabel}</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={gradeChartData} margin={{ top: 0, right: 8, left: -16, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip
                      formatter={(v: number) => [v.toFixed(2), 'Средний балл']}
                      contentStyle={{ borderRadius: 8, fontSize: 11 }}
                    />
                    <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                      {gradeChartData.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {attChartData.length > 0 && (
              <div
                onClick={() => navigate('/attendance')}
                className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm cursor-pointer hover:shadow-md hover:border-slate-200 transition-all"
              >
                <h2 className="text-base font-semibold text-slate-700 mb-1">Посещаемость по группам</h2>
                <p className="text-xs text-slate-400 mb-4">{subjectLabel}</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={attChartData} margin={{ top: 0, right: 8, left: -16, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} unit="%" />
                    <Tooltip
                      formatter={(v: number) => [`${v}%`, 'Посещаемость']}
                      contentStyle={{ borderRadius: 8, fontSize: 11 }}
                    />
                    <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                      {attChartData.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Таблица студентов — все группы */}
          {sortedStudents.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-700">
                  Студенты — все группы
                </h2>
                <SortButton dir={sortDir} onChange={setSortDir} />
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-slate-500 font-medium w-8">#</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">ФИО</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Группа</th>
                    <th className="text-right px-6 py-3 text-slate-500 font-medium">Средний балл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedStudents.map((s, i) => (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/students/${s.id}`)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-3 text-slate-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-3 text-slate-800">{s.name}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{s.group}</td>
                      <td className="px-6 py-3 text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          s.avg_grade >= 4.5 ? 'bg-emerald-100 text-emerald-700' :
                          s.avg_grade >= 3.5 ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {Number(s.avg_grade).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SortButton({ dir, onChange }: { dir: SortDir; onChange: (d: SortDir) => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(dir === 'desc' ? 'asc' : 'desc') }}
      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600
                 border border-slate-200 rounded-lg px-2.5 py-1 hover:border-blue-300 transition-colors cursor-pointer"
    >
      {dir === 'desc' ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          По убыванию
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          По возрастанию
        </>
      )}
    </button>
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
