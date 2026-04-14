import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  Box, Paper, Typography, Chip, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material'
import { ArrowDownwardRounded, ArrowUpwardRounded } from '@mui/icons-material'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import {
  getGroupSummary, getGroupAttendanceBySubject, getTopStudents,
} from '../../api/analytics'
import type { GroupSummaryRow, AttendanceBySubjectRow, TopStudent } from '../../api/analytics'
import client from '../../api/client'
import { WARM } from '../../theme'

type SortDir = 'desc' | 'asc'

interface GroupData {
  summary: GroupSummaryRow[]
  attendance: AttendanceBySubjectRow[]
  students: TopStudent[]
  avgGrade: number | null
  avgAttendance: number | null
}

const BAR_COLORS = ['#C9874A', '#347856', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

export default function TeacherDashboard() {
  const navigate = useNavigate()
  const [teacherName, setTeacherName] = useState('')
  const [groupIds, setGroupIds] = useState<number[]>([])
  const [groupNames, setGroupNames] = useState<Record<number, string>>({})
  const [subjectLabel, setSubjectLabel] = useState('')
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
        const mySubjectNames = new Set(mySubjectIds.map(id => subjectNameMap[id]).filter(Boolean))

        const subjectArr = Array.from(mySubjectNames)
        setSubjectLabel(subjectArr.length === 1 ? `по ${subjectArr[0]}` : 'по моим дисциплинам')

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
          data[ids[i]] = { summary: filteredSummary, attendance: filteredAtt, students, avgGrade, avgAttendance: avgAtt }
          combinedStudents.push(...students)
        }

        setGroupData(data)

        const byId = new Map<number, TopStudent>()
        for (const s of combinedStudents) {
          const ex = byId.get(s.id)
          if (!ex || Number(s.avg_grade) > Number(ex.avg_grade)) byId.set(s.id, s)
        }
        setAllStudents(Array.from(byId.values()))
      } catch { /* silent */ } finally { setLoading(false) }
    }
    init()
  }, [])

  if (loading) return <Spin />

  const gradeChartData = groupIds
    .map(id => ({ name: groupNames[id] ?? `Группа ${id}`, avg: groupData[id]?.avgGrade != null ? Number(groupData[id].avgGrade!.toFixed(2)) : 0, hasData: groupData[id]?.avgGrade != null }))
    .filter(d => d.hasData)

  const attChartData = groupIds
    .map(id => ({ name: groupNames[id] ?? `Группа ${id}`, rate: groupData[id]?.avgAttendance ?? 0, hasData: groupData[id]?.avgAttendance != null }))
    .filter(d => d.hasData)

  const sortedStudents = [...allStudents].sort((a, b) =>
    sortDir === 'desc' ? Number(b.avg_grade) - Number(a.avg_grade) : Number(a.avg_grade) - Number(b.avg_grade)
  )

  return (
    <Box sx={{ p: 4, maxWidth: 960 }}>
      <Typography variant="h5" fontWeight={700}>Главная</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>{teacherName}</Typography>

      {groupIds.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}><Typography color="text.secondary">Нет назначенных групп. Обратитесь к администратору.</Typography></Paper>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(groupIds.length * 2 + 1, 3)}, 1fr)`, gap: 2, mb: 4 }}>
            <Paper elevation={1} onClick={() => navigate('/my-groups')}
              sx={{ p: 2.5, cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}>
              <Typography variant="caption" color="text.secondary">Моих групп</Typography>
              <Typography variant="h4" fontWeight={700} sx={{ color: WARM[800] }}>{groupIds.length}</Typography>
            </Paper>
            {groupIds.map(id => (
              <Paper key={`grade-${id}`} elevation={1} onClick={() => navigate('/grades')}
                sx={{ p: 2.5, cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}>
                <Typography variant="caption" color="text.secondary">Средний балл {subjectLabel}</Typography>
                <Typography variant="h4" fontWeight={700} sx={{ color: WARM[800] }}>
                  {groupData[id]?.avgGrade != null ? groupData[id].avgGrade!.toFixed(2) : '—'}
                </Typography>
                <Typography variant="caption" color="text.disabled">{groupNames[id] ?? `Группа ${id}`}</Typography>
              </Paper>
            ))}
            {groupIds.map(id => (
              <Paper key={`att-${id}`} elevation={1} onClick={() => navigate('/attendance')}
                sx={{ p: 2.5, cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}>
                <Typography variant="caption" color="text.secondary">Средняя посещаемость {subjectLabel}</Typography>
                <Typography variant="h4" fontWeight={700} sx={{ color: groupData[id]?.avgAttendance != null && groupData[id].avgAttendance! >= 75 ? '#347856' : '#C9874A' }}>
                  {groupData[id]?.avgAttendance != null ? `${groupData[id].avgAttendance}%` : '—'}
                </Typography>
                <Typography variant="caption" color="text.disabled">{groupNames[id] ?? `Группа ${id}`}</Typography>
              </Paper>
            ))}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 4 }}>
            {gradeChartData.length > 0 && (
              <Paper elevation={1} onClick={() => navigate('/grades')}
                sx={{ p: 3, cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}>
                <Typography variant="subtitle2" fontWeight={600}>Средний балл по группам</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>{subjectLabel}</Typography>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={gradeChartData} margin={{ top: 0, right: 8, left: -16, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip formatter={(v: number) => [v.toFixed(2), 'Средний балл']} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                      {gradeChartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            )}
            {attChartData.length > 0 && (
              <Paper elevation={1} onClick={() => navigate('/attendance')}
                sx={{ p: 3, cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}>
                <Typography variant="subtitle2" fontWeight={600}>Посещаемость по группам</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>{subjectLabel}</Typography>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={attChartData} margin={{ top: 0, right: 8, left: -16, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} unit="%" />
                    <Tooltip formatter={(v: number) => [`${v}%`, 'Посещаемость']} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                      {attChartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            )}
          </Box>

          {sortedStudents.length > 0 && (
            <Paper elevation={2} sx={{ overflow: 'hidden' }}>
              <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" fontWeight={600}>Студенты — все группы</Typography>
                <Box
                  component="button"
                  onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, border: 1, borderColor: 'divider', borderRadius: 1, px: 1.5, py: 0.75, fontSize: 12, color: 'text.secondary', cursor: 'pointer', bgcolor: 'transparent', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  {sortDir === 'desc' ? <ArrowDownwardRounded sx={{ fontSize: 14 }} /> : <ArrowUpwardRounded sx={{ fontSize: 14 }} />}
                  {sortDir === 'desc' ? 'По убыванию' : 'По возрастанию'}
                </Box>
              </Box>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 40 }}>#</TableCell>
                    <TableCell>ФИО</TableCell>
                    <TableCell>Группа</TableCell>
                    <TableCell align="right">Средний балл</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedStudents.map((s, i) => (
                    <TableRow key={s.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/students/${s.id}`)}>
                      <TableCell sx={{ color: 'text.disabled', fontWeight: 500 }}>{i + 1}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{s.group}</TableCell>
                      <TableCell align="right">
                        <Chip label={Number(s.avg_grade).toFixed(2)} size="small" sx={
                          s.avg_grade >= 4.5 ? { bgcolor: '#D4EDDF', color: '#347856' } :
                          s.avg_grade >= 3.5 ? { bgcolor: '#DBEAFE', color: '#1D4ED8' } :
                          { bgcolor: '#F5E2CE', color: '#C9874A' }
                        } />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </>
      )}
    </Box>
  )
}

const Spin = () => <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress color="primary" /></Box>
