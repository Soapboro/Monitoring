import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts'
import {
  Box, Paper, Typography, Chip, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material'
import {
  getMyStudentProfile, getMyGrades, getMySessions, getMyAttendance,
} from '../../api/resources'
import type { StudentProfile, GradeOut, TestSession, AttendanceRecord } from '../../api/resources'
import { getStudentSubjects, getStudentProgress } from '../../api/analytics'
import type { StudentSubjectRow, StudentProgressRow } from '../../api/analytics'
import { WARM } from '../../theme'

export default function StudentDashboard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [grades, setGrades] = useState<GradeOut[]>([])
  const [sessions, setSessions] = useState<TestSession[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [subjectSummary, setSubjectSummary] = useState<StudentSubjectRow[]>([])
  const [progress, setProgress] = useState<StudentProgressRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const [prof, gr, sess, att] = await Promise.all([
          getMyStudentProfile(), getMyGrades(), getMySessions(), getMyAttendance(),
        ])
        setProfile(prof); setGrades(gr); setSessions(sess); setAttendance(att)
        const [subj, prog] = await Promise.all([
          getStudentSubjects(prof.id), getStudentProgress(prof.id),
        ])
        setSubjectSummary(subj); setProgress(prog)
      } catch { /* silent */ } finally { setLoading(false) }
    }
    init()
  }, [])

  if (loading) return <Spin />

  const completedSessions = sessions.filter(s => s.status === 'completed')
  const presentCount = attendance.filter(a => a.is_present).length
  const attendanceRate = attendance.length > 0 ? Math.round(presentCount / attendance.length * 100) : null
  const numericGrades = grades.filter(g => g.value !== null)
  const avgGradeAll = numericGrades.length > 0
    ? (numericGrades.reduce((s, g) => s + (g.value ?? 0), 0) / numericGrades.length).toFixed(2)
    : null

  const subjectChartData = subjectSummary.map(r => ({
    name: r.subject.length > 14 ? r.subject.slice(0, 12) + '…' : r.subject,
    fullName: r.subject, avg: Number(r.avg_grade),
  }))

  const uniqueSubjects = [...new Set(progress.map(r => r.subject))].slice(0, 5)
  const SUBJECT_COLORS = ['#C9874A', '#347856', '#f59e0b', '#8b5cf6', '#ef4444']

  const progressByDate: Record<string, Record<string, number>> = {}
  for (const r of progress) {
    const d = r.date_recorded.slice(0, 10)
    if (!progressByDate[d]) progressByDate[d] = {}
    progressByDate[d][r.subject] = r.value
  }
  const progressLineData = Object.entries(progressByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, ...vals }))

  const statCards = [
    { label: 'Средний балл', value: avgGradeAll ?? '—', sub: 'по всем предметам', color: '#C9874A', to: '/my-grades' },
    { label: 'Всего оценок', value: numericGrades.length, color: '#347856', to: '/my-grades' },
    { label: 'Тестов пройдено', value: completedSessions.length, color: '#8b5cf6', to: '/my-tests' },
    { label: 'Посещаемость', value: attendanceRate !== null ? `${attendanceRate}%` : '—', sub: `${presentCount} из ${attendance.length} занятий`, color: '#f59e0b', to: '/my-attendance' },
  ]

  return (
    <Box sx={{ p: 4, maxWidth: 960 }}>
      <Typography variant="h5" fontWeight={700}>Главная</Typography>
      {profile && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          {profile.last_name} {profile.first_name} {profile.middle_name ?? ''}
          {profile.student_num && ` · ${profile.student_num}`}
        </Typography>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 4 }}>
        {statCards.map(card => (
          <Paper key={card.label} elevation={1}
            onClick={() => navigate(card.to)}
            sx={{ p: 2.5, cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: card.color, mb: 1.5 }} />
            <Typography variant="h4" fontWeight={700} sx={{ color: WARM[800] }}>{card.value}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{card.label}</Typography>
            {card.sub && <Typography variant="caption" color="text.disabled">{card.sub}</Typography>}
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 4 }}>
        {subjectChartData.length > 0 && (
          <Paper elevation={1} onClick={() => navigate('/my-grades')}
            sx={{ p: 3, cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}>
            <Typography variant="subtitle2" fontWeight={600}>Средний балл по предметам</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>Все дисциплины</Typography>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={subjectChartData} margin={{ top: 0, right: 8, left: -16, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip formatter={(v: number) => [v.toFixed(2), 'Средний балл']} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="avg" fill="#C9874A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        )}
        {progressLineData.length > 1 && (
          <Paper elevation={1} onClick={() => navigate('/my-grades')}
            sx={{ p: 3, cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}>
            <Typography variant="subtitle2" fontWeight={600}>Динамика оценок</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>По дате выставления</Typography>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={progressLineData} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} />
                <YAxis domain={[1, 5]} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {uniqueSubjects.map((subj, i) => (
                  <Line key={subj} type="monotone" dataKey={subj}
                    stroke={SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
                    dot={false} strokeWidth={2} connectNulls
                    name={subj.length > 20 ? subj.slice(0, 18) + '…' : subj}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        )}
      </Box>

      {grades.length > 0 && (
        <Paper elevation={2} sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1" fontWeight={600}>Последние оценки</Typography>
            <Typography variant="caption" sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
              onClick={() => navigate('/my-grades')}>
              Все оценки →
            </Typography>
          </Box>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Дата</TableCell>
                <TableCell>Тип</TableCell>
                <TableCell align="right">Оценка</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {grades.slice(0, 8).map(g => (
                <TableRow key={g.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate('/my-grades')}>
                  <TableCell sx={{ color: 'text.secondary' }}>{g.date_recorded.slice(0, 10)}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>{g.grade_type}</TableCell>
                  <TableCell align="right">
                    {g.value !== null ? (
                      <Chip label={g.value} size="small" sx={
                        g.value >= 4 ? { bgcolor: '#D4EDDF', color: '#347856' } :
                        g.value >= 3 ? { bgcolor: '#DBEAFE', color: '#1D4ED8' } :
                                       { bgcolor: '#F4D0CC', color: '#D05050' }
                      } />
                    ) : <Typography variant="body2" color="text.disabled">—</Typography>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {grades.length === 0 && sessions.length === 0 && (
        <Paper sx={{ p: 6, textAlign: 'center' }}><Typography color="text.secondary">Данных пока нет. Скоро здесь появится статистика.</Typography></Paper>
      )}
    </Box>
  )
}

const Spin = () => <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress color="primary" /></Box>
