import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import {
  Box, Paper, Typography, TextField, Chip, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, InputAdornment,
  ToggleButtonGroup, ToggleButton,
} from '@mui/material'
import { SearchRounded, ArrowUpwardRounded, ArrowDownwardRounded } from '@mui/icons-material'
import { getStudents, getTeachers, getGroups, getSubjects } from '../../api/resources'
import {
  getTopStudents, getRatingByGroups, getRatingBySubjects,
} from '../../api/analytics'
import type { TopStudent, GroupRatingRow, SubjectRatingRow } from '../../api/analytics'
import { WARM, PEACH } from '../../theme'

interface Stats { students: number; teachers: number; groups: number; subjects: number }

type Mode = 'students' | 'groups' | 'subjects'
type SortDir = 'desc' | 'asc'

const COLORS = ['#C9874A', '#8b5cf6', '#347856', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1']

const gradeChipSx = (avg: number) =>
  avg >= 4.5 ? { bgcolor: '#D4EDDF', color: '#347856' } :
  avg >= 3.5 ? { bgcolor: '#DBEAFE', color: '#1D4ED8' } :
  avg >= 2.5 ? { bgcolor: '#F5E2CE', color: '#C9874A' } :
               { bgcolor: '#F4D0CC', color: '#D05050' }

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [students, setStudents] = useState<TopStudent[]>([])
  const [groups, setGroups] = useState<GroupRatingRow[]>([])
  const [subjects, setSubjects] = useState<SubjectRatingRow[]>([])
  const [mode, setMode] = useState<Mode>('students')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getStudents(), getTeachers(), getGroups(), getSubjects(),
      getTopStudents(), getRatingByGroups(), getRatingBySubjects(),
    ]).then(([sts, tch, grps, subjs, top, grpRating, subjRating]) => {
      setStats({ students: sts.length, teachers: tch.length, groups: grps.length, subjects: subjs.length })
      setStudents(top)
      setGroups(grpRating)
      setSubjects(subjRating)
    }).finally(() => setLoading(false))
  }, [])

  const handleMode = (m: Mode) => { setMode(m); setSearch('') }

  const sortedStudents = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = q
      ? students.filter(s => s.name.toLowerCase().includes(q) || s.group.toLowerCase().includes(q))
      : students
    return [...filtered].sort((a, b) =>
      sortDir === 'desc' ? Number(b.avg_grade) - Number(a.avg_grade) : Number(a.avg_grade) - Number(b.avg_grade)
    )
  }, [students, sortDir, search])

  const sortedGroups = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = q ? groups.filter(g => g.group.toLowerCase().includes(q)) : groups
    return [...filtered].sort((a, b) =>
      sortDir === 'desc' ? Number(b.avg_grade) - Number(a.avg_grade) : Number(a.avg_grade) - Number(b.avg_grade)
    )
  }, [groups, sortDir, search])

  const sortedSubjects = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = q ? subjects.filter(s => s.subject.toLowerCase().includes(q)) : subjects
    return [...filtered].sort((a, b) =>
      sortDir === 'desc' ? Number(b.avg_grade) - Number(a.avg_grade) : Number(a.avg_grade) - Number(b.avg_grade)
    )
  }, [subjects, sortDir, search])

  if (loading) return <Spin />

  const statCards = [
    { label: 'Студентов', value: stats?.students ?? 0, to: '/students' },
    { label: 'Преподавателей', value: stats?.teachers ?? 0, to: '/teachers' },
    { label: 'Учебных групп', value: stats?.groups ?? 0, to: '/groups' },
    { label: 'Дисциплин', value: stats?.subjects ?? 0, to: '/subjects' },
  ]

  const chartItems =
    mode === 'students' ? sortedStudents.slice(0, 15).map(s => ({ name: s.name.split(' ').slice(0, 2).join(' '), avg: Number(s.avg_grade), sub: s.group })) :
    mode === 'groups'   ? sortedGroups.slice(0, 15).map(g => ({ name: g.group, avg: Number(g.avg_grade), sub: `${g.students_count} студ.` })) :
                          sortedSubjects.slice(0, 15).map(s => ({ name: s.subject.length > 20 ? s.subject.slice(0, 20) + '…' : s.subject, avg: Number(s.avg_grade), sub: `${s.students_count} студ.` }))

  return (
    <Box sx={{ p: 4, maxWidth: 960 }}>
      <Typography variant="h5" fontWeight={700}>Главная</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>Общая статистика системы</Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 4 }}>
        {statCards.map(card => (
          <Paper key={card.label} elevation={1}
            onClick={() => navigate(card.to)}
            sx={{ p: 2.5, cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}>
            <Typography variant="h4" fontWeight={700} sx={{ color: WARM[800] }}>{card.value}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{card.label}</Typography>
          </Paper>
        ))}
      </Box>

      <Paper elevation={2} sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>Рейтинг успеваемости</Typography>
              <Typography variant="caption" color="text.secondary">
                {mode === 'students' && `${sortedStudents.length} студентов`}
                {mode === 'groups' && `${sortedGroups.length} групп`}
                {mode === 'subjects' && `${sortedSubjects.length} предметов`}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder={mode === 'students' ? 'Поиск студента...' : mode === 'groups' ? 'Поиск группы...' : 'Поиск предмета...'}
                value={search} onChange={e => setSearch(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> } }}
                sx={{ width: 200 }}
              />
              <Box
                component="button"
                onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, border: 1, borderColor: 'divider', borderRadius: 1, px: 1.5, py: 0.75, fontSize: 12, color: 'text.secondary', cursor: 'pointer', bgcolor: 'transparent', '&:hover': { bgcolor: 'action.hover' } }}
              >
                {sortDir === 'desc' ? <ArrowDownwardRounded sx={{ fontSize: 14 }} /> : <ArrowUpwardRounded sx={{ fontSize: 14 }} />}
                {sortDir === 'desc' ? 'По убыванию' : 'По возрастанию'}
              </Box>
              <ToggleButtonGroup size="small" value={mode} exclusive onChange={(_, v) => v && handleMode(v)}>
                <ToggleButton value="students">Студенты</ToggleButton>
                <ToggleButton value="groups">Группы</ToggleButton>
                <ToggleButton value="subjects">Предметы</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>
        </Box>

        {chartItems.length > 0 && (
          <Box sx={{ px: 3, pt: 2.5, pb: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
              Топ-{chartItems.length} (по среднему баллу)
            </Typography>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartItems} margin={{ top: 0, right: 16, left: -10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(v: number) => [v.toFixed(2), 'Средний балл']}
                  labelFormatter={(label, payload) => {
                    const sub = payload?.[0]?.payload?.sub
                    return `${label}${sub ? ` (${sub})` : ''}`
                  }}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                  {chartItems.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        )}

        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }}>#</TableCell>
              {mode === 'students' && <>
                <TableCell>ФИО</TableCell>
                <TableCell>Группа</TableCell>
              </>}
              {mode === 'groups' && <>
                <TableCell>Группа</TableCell>
                <TableCell align="right">Студентов</TableCell>
                <TableCell align="right">Оценок</TableCell>
              </>}
              {mode === 'subjects' && <>
                <TableCell>Предмет</TableCell>
                <TableCell align="right">Студентов</TableCell>
                <TableCell align="right">Оценок</TableCell>
              </>}
              <TableCell align="right">Средний балл</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mode === 'students' && sortedStudents.map((s, i) => (
              <TableRow key={s.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/students/${s.id}`)}>
                <TableCell sx={{ color: 'text.disabled', fontWeight: 500 }}>{i + 1}</TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{s.name}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{s.group}</TableCell>
                <TableCell align="right">
                  <Chip label={Number(s.avg_grade).toFixed(2)} size="small" sx={gradeChipSx(Number(s.avg_grade))} />
                </TableCell>
              </TableRow>
            ))}
            {mode === 'groups' && sortedGroups.map((g, i) => (
              <TableRow key={g.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/groups/${g.id}`)}>
                <TableCell sx={{ color: 'text.disabled', fontWeight: 500 }}>{i + 1}</TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{g.group}</TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>{g.students_count}</TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>{g.grades_count}</TableCell>
                <TableCell align="right">
                  <Chip label={Number(g.avg_grade).toFixed(2)} size="small" sx={gradeChipSx(Number(g.avg_grade))} />
                </TableCell>
              </TableRow>
            ))}
            {mode === 'subjects' && sortedSubjects.map((s, i) => (
              <TableRow key={s.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/subjects/${s.id}`)}>
                <TableCell sx={{ color: 'text.disabled', fontWeight: 500 }}>{i + 1}</TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{s.subject}</TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>{s.students_count}</TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>{s.grades_count}</TableCell>
                <TableCell align="right">
                  <Chip label={Number(s.avg_grade).toFixed(2)} size="small" sx={gradeChipSx(Number(s.avg_grade))} />
                </TableCell>
              </TableRow>
            ))}
            {(mode === 'students' && sortedStudents.length === 0) ||
             (mode === 'groups' && sortedGroups.length === 0) ||
             (mode === 'subjects' && sortedSubjects.length === 0) ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 5, color: 'text.disabled' }}>Нет данных</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  )
}

const Spin = () => <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress color="primary" /></Box>
