import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, Chip, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, LinearProgress,
} from '@mui/material'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, ReferenceLine,
} from 'recharts'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import { getGroupSummary, getTopStudents, getGroupDynamics } from '../../api/analytics'
import type { GroupSummaryRow, TopStudent, GroupDynamics } from '../../api/analytics'
import client from '../../api/client'

function mergeSummaries(all: GroupSummaryRow[]): GroupSummaryRow[] {
  const bySubject = new Map<string, GroupSummaryRow[]>()
  for (const row of all) {
    const key = row.subject
    if (!bySubject.has(key)) bySubject.set(key, [])
    bySubject.get(key)!.push(row)
  }
  return Array.from(bySubject.entries()).map(([subject, rows]) => {
    const totalStudents = rows.reduce((s, r) => s + r.students_count, 0)
    const weightedAvg = totalStudents > 0
      ? rows.reduce((s, r) => s + r.avg_grade * r.students_count, 0) / totalStudents
      : 0
    return {
      subject, acad_year: rows[0].acad_year, semester: rows[0].semester,
      students_count: totalStudents, avg_grade: weightedAvg,
      min_grade: Math.min(...rows.map(r => r.min_grade)),
      max_grade: Math.max(...rows.map(r => r.max_grade)),
      tests_total: rows.reduce((s, r) => s + r.tests_total, 0),
      tests_passed: rows.reduce((s, r) => s + r.tests_passed, 0),
    }
  }).sort((a, b) => a.subject.localeCompare(b.subject))
}

function mergeStudents(all: TopStudent[]): TopStudent[] {
  const byId = new Map<number, TopStudent>()
  for (const s of all) {
    const ex = byId.get(s.id)
    if (!ex || s.avg_grade > ex.avg_grade) byId.set(s.id, s)
  }
  return Array.from(byId.values()).sort((a, b) => b.avg_grade - a.avg_grade)
}

const gradeChip = (avg: number) =>
  avg >= 4.5 ? { bgcolor: '#D4EDDF', color: '#347856' } :
  avg >= 3.5 ? { bgcolor: '#DBEAFE', color: '#1D4ED8' } :
               { bgcolor: '#F5E2CE', color: '#C9874A' }

export default function AnalyticsPage() {
  const navigate = useNavigate()
  const [groupIds, setGroupIds] = useState<number[]>([])
  const [groupNames, setGroupNames] = useState<Record<number, string>>({})
  const [gradeSummary, setGradeSummary] = useState<GroupSummaryRow[]>([])
  const [topStudents, setTopStudents] = useState<TopStudent[]>([])
  const [dynamics, setDynamics] = useState<GroupDynamics[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const teacher = await getMyTeacherProfile()
        const [assignments, groups] = await Promise.all([
          getAssignments(teacher.id),
          client.get<{ id: number; name: string }[]>('/groups').then(r => r.data),
        ])
        const ids = [...new Set(assignments.map(a => a.group_id))]
        setGroupIds(ids)
        const nameMap: Record<number, string> = {}
        for (const g of groups) nameMap[g.id] = g.name
        setGroupNames(nameMap)
        if (ids.length === 0) return
        const [allSummaries, allStudents, allDynamics] = await Promise.all([
          Promise.all(ids.map(id => getGroupSummary(id))).then(results => results.flat()),
          Promise.all(ids.map(id => getTopStudents(id))).then(results => results.flat()),
          Promise.all(ids.map(id => getGroupDynamics(id))),
        ])
        setGradeSummary(mergeSummaries(allSummaries))
        setTopStudents(mergeStudents(allStudents))
        setDynamics(allDynamics)
      } finally { setLoading(false) }
    }
    init()
  }, [])

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>

  const chartData = gradeSummary.map(r => ({
    name: r.subject.length > 16 ? r.subject.slice(0, 14) + '…' : r.subject,
    fullName: r.subject,
    avg: Number(r.avg_grade),
    min: Number(r.min_grade),
    max: Number(r.max_grade),
    students: r.students_count,
    testsTotal: r.tests_total,
    testsPassed: r.tests_passed,
  }))

  const groupLabel = groupIds.length > 0 ? groupIds.map(id => groupNames[id] ?? `Группа ${id}`).join(', ') : ''

  // Build merged dynamics chart data: periods across all groups
  const dynChartData = (() => {
    const periodMap = new Map<string, { period: string; [grp: string]: number | string }>()
    dynamics.forEach((d, idx) => {
      const grpName = groupNames[groupIds[idx]] ?? `Группа ${groupIds[idx]}`
      d.periods.forEach(p => {
        const key = `${p.acad_year} · сем.${p.semester}`
        if (!periodMap.has(key)) periodMap.set(key, { period: key })
        periodMap.get(key)![grpName] = Number(p.avg_grade)
      })
    })
    return Array.from(periodMap.values())
  })()

  const dynGroupNames = groupIds.map(id => groupNames[id] ?? `Группа ${id}`)
  const LINE_COLORS = ['#C9874A', '#347856', '#1D4ED8', '#9333ea', '#0891b2']

  return (
    <Box sx={{ p: 4, maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>Аналитика</Typography>
        {groupLabel && <Typography variant="body2" color="text.secondary">{groupLabel}</Typography>}
      </Box>

      {groupIds.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}><Typography color="text.secondary">Нет назначенных групп</Typography></Paper>
      ) : (
        <>
          {chartData.length > 0 && (
            <Paper elevation={1} sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight={600}>Средний балл по дисциплинам</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>{groupLabel}</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 0, right: 16, left: -10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(v: number, key: string) => [v.toFixed(2), key === 'avg' ? 'Средний' : key === 'min' ? 'Мин' : 'Макс']}
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload
                      if (!p) return ''
                      const tests = p.testsTotal > 0 ? ` · тесты: ${p.testsPassed}/${p.testsTotal}` : ''
                      return `${p.fullName}${tests}`
                    }}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="avg" fill="#C9874A" radius={[4, 4, 0, 0]} name="avg" />
                  <Bar dataKey="min" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="min" />
                  <Bar dataKey="max" fill="#347856" radius={[4, 4, 0, 0]} name="max" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          )}

          {gradeSummary.some(r => r.tests_total > 0) && (
            <Paper elevation={2} sx={{ overflow: 'hidden' }}>
              <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle1" fontWeight={600}>Тесты по дисциплинам</Typography>
                <Typography variant="caption" color="text.secondary">{groupLabel}</Typography>
              </Box>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Дисциплина</TableCell>
                    <TableCell align="right">Сдали / Студентов</TableCell>
                    <TableCell align="right">Прогресс</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gradeSummary.filter(r => r.tests_total > 0).map(r => {
                    const pct = r.tests_total > 0 ? Math.round(r.tests_passed / r.tests_total * 100) : 0
                    return (
                      <TableRow key={r.subject} hover>
                        <TableCell>{r.subject}</TableCell>
                        <TableCell align="right">
                          <Typography component="span" fontWeight={600} sx={{ color: r.tests_passed >= r.tests_total ? '#347856' : 'text.primary' }}>
                            {r.tests_passed}
                          </Typography>
                          <Typography component="span" color="text.disabled"> / {r.tests_total}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={pct}
                              sx={{
                                width: 96, height: 6, borderRadius: 3,
                                bgcolor: '#e2e8f0',
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: pct >= 80 ? '#347856' : pct >= 50 ? '#1D4ED8' : '#C9874A',
                                  borderRadius: 3,
                                },
                              }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36, textAlign: 'right' }}>{pct}%</Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Paper>
          )}

          {dynChartData.length > 1 && (
            <Paper elevation={1} sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight={600}>Динамика среднего балла по семестрам</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>{groupLabel}</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={dynChartData} margin={{ top: 4, right: 16, left: -10, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis domain={[1, 5]} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <ReferenceLine y={3} stroke="#e2e8f0" strokeDasharray="4 2" />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [v.toFixed(2), '']} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  {dynGroupNames.map((name, i) => (
                    <Line
                      key={name} type="monotone" dataKey={name}
                      stroke={LINE_COLORS[i % LINE_COLORS.length]}
                      strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          )}

          {topStudents.length > 0 && (
            <Paper elevation={2} sx={{ overflow: 'hidden' }}>
              <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" fontWeight={600}>Рейтинг студентов</Typography>
                <Typography variant="caption" color="text.disabled">{topStudents.length} студентов</Typography>
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
                  {topStudents.map((s, i) => (
                    <TableRow key={s.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/my-students/${s.id}`)}>
                      <TableCell sx={{ fontWeight: 500, color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'text.disabled' }}>
                        {i + 1}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{s.name}</TableCell>
                      <TableCell sx={{ color: 'text.disabled', fontSize: 12 }}>{s.group}</TableCell>
                      <TableCell align="right">
                        <Chip label={Number(s.avg_grade).toFixed(2)} size="small" sx={gradeChip(Number(s.avg_grade))} />
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
