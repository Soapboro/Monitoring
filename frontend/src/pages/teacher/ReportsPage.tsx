import { useEffect, useState } from 'react'
import {
  Box, Paper, Typography, Button, CircularProgress,
  MenuItem, TextField, Stack,
} from '@mui/material'
import {
  TableChartRounded, PictureAsPdfRounded, BarChartRounded,
} from '@mui/icons-material'
import client from '../../api/client'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import { useAuthStore } from '../../store/authStore'
import {
  downloadGradesExcel, downloadGradesPdf,
  downloadAttendanceExcel, downloadAnalyticsExcel,
} from '../../api/reports'

interface Group { id: number; name: string }
interface Subject { id: number; name: string }

const GRADE_TYPES = [
  { value: '', label: 'Все типы' },
  { value: 'current', label: 'Текущая' },
  { value: 'thematic', label: 'Тематическая' },
  { value: 'midterm', label: 'Промежуточная' },
  { value: 'final', label: 'Итоговая' },
  { value: 'test', label: 'Тест' },
  { value: 'attendance', label: 'За посещение' },
]

export default function ReportsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Grade report filters
  const [gradeGroup, setGradeGroup] = useState('')
  const [gradeSubject, setGradeSubject] = useState('')
  const [gradeYear, setGradeYear] = useState('')
  const [gradeType, setGradeType] = useState('')

  // Attendance report filters
  const [attGroup, setAttGroup] = useState('')
  const [attSubject, setAttSubject] = useState('')
  const [attDateFrom, setAttDateFrom] = useState('')
  const [attDateTo, setAttDateTo] = useState('')

  // Analytics report filters
  const [anlGroup, setAnlGroup] = useState('')
  const [anlSubject, setAnlSubject] = useState('')
  const [anlYear, setAnlYear] = useState('')

  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    async function init() {
      try {
        if (isAdmin) {
          const [g, s] = await Promise.all([
            client.get<Group[]>('/groups').then(r => r.data),
            client.get<Subject[]>('/subjects').then(r => r.data),
          ])
          setGroups(g)
          setSubjects(s)
        } else {
          const teacher = await getMyTeacherProfile()
          const assignments = await getAssignments(teacher.id)
          const groupIds = [...new Set(assignments.map(a => a.group_id))]
          const subjectIds = [...new Set(assignments.map(a => a.subject_id))]
          const [allGroups, allSubjects] = await Promise.all([
            client.get<Group[]>('/groups').then(r => r.data),
            client.get<Subject[]>('/subjects').then(r => r.data),
          ])
          setGroups(allGroups.filter(g => groupIds.includes(g.id)))
          setSubjects(allSubjects.filter(s => subjectIds.includes(s.id)))
        }
      } finally { setLoading(false) }
    }
    init()
  }, [isAdmin])

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key)
    setError(null)
    try { await fn() } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка при формировании отчёта')
    } finally { setBusy(null) }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>

  return (
    <Box sx={{ p: 4, maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Typography variant="h5" fontWeight={700}>Отчёты</Typography>
      {error && (
        <Box sx={{ px: 2, py: 1.5, bgcolor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 2 }}>
          <Typography variant="body2" sx={{ color: '#D05050' }}>{error}</Typography>
        </Box>
      )}

      {/* ── Grades ─────────────────────────────────────────────── */}
      <Section icon={<TableChartRounded />} title="Ведомость успеваемости">
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <SelectField label="Группа" value={gradeGroup} onChange={setGradeGroup}>
            <MenuItem value="">Все группы</MenuItem>
            {groups.map(g => <MenuItem key={g.id} value={String(g.id)}>{g.name}</MenuItem>)}
          </SelectField>
          <SelectField label="Дисциплина" value={gradeSubject} onChange={setGradeSubject}>
            <MenuItem value="">Все дисциплины</MenuItem>
            {subjects.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>)}
          </SelectField>
          <TextField
            label="Уч. год" size="small" value={gradeYear}
            onChange={e => setGradeYear(e.target.value)}
            placeholder="2024-2025" sx={{ minWidth: 130 }}
          />
          <SelectField label="Тип оценки" value={gradeType} onChange={setGradeType}>
            {GRADE_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </SelectField>
        </Stack>
        <Stack direction="row" spacing={1.5} mt={2}>
          <DownloadBtn
            label="Excel" icon={<TableChartRounded fontSize="small" />}
            loading={busy === 'grades-xlsx'}
            onClick={() => run('grades-xlsx', () => downloadGradesExcel({
              group_id: gradeGroup ? Number(gradeGroup) : undefined,
              subject_id: gradeSubject ? Number(gradeSubject) : undefined,
              acad_year: gradeYear || undefined,
              grade_type: gradeType || undefined,
            }))}
          />
          <DownloadBtn
            label="PDF" icon={<PictureAsPdfRounded fontSize="small" />} color="error"
            loading={busy === 'grades-pdf'}
            onClick={() => run('grades-pdf', () => downloadGradesPdf({
              group_id: gradeGroup ? Number(gradeGroup) : undefined,
              subject_id: gradeSubject ? Number(gradeSubject) : undefined,
              acad_year: gradeYear || undefined,
              grade_type: gradeType || undefined,
            }))}
          />
        </Stack>
      </Section>

      {/* ── Attendance ─────────────────────────────────────────── */}
      <Section icon={<TableChartRounded />} title="Посещаемость">
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <SelectField label="Группа" value={attGroup} onChange={setAttGroup}>
            <MenuItem value="">Все группы</MenuItem>
            {groups.map(g => <MenuItem key={g.id} value={String(g.id)}>{g.name}</MenuItem>)}
          </SelectField>
          <SelectField label="Дисциплина" value={attSubject} onChange={setAttSubject}>
            <MenuItem value="">Все дисциплины</MenuItem>
            {subjects.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>)}
          </SelectField>
          <TextField
            label="Дата от" type="date" size="small" value={attDateFrom}
            onChange={e => setAttDateFrom(e.target.value)}
            InputLabelProps={{ shrink: true }} sx={{ minWidth: 155 }}
          />
          <TextField
            label="Дата до" type="date" size="small" value={attDateTo}
            onChange={e => setAttDateTo(e.target.value)}
            InputLabelProps={{ shrink: true }} sx={{ minWidth: 155 }}
          />
        </Stack>
        <Box mt={2}>
          <DownloadBtn
            label="Excel" icon={<TableChartRounded fontSize="small" />}
            loading={busy === 'att-xlsx'}
            onClick={() => run('att-xlsx', () => downloadAttendanceExcel({
              group_id: attGroup ? Number(attGroup) : undefined,
              subject_id: attSubject ? Number(attSubject) : undefined,
              date_from: attDateFrom || undefined,
              date_to: attDateTo || undefined,
            }))}
          />
        </Box>
      </Section>

      {/* ── Analytics ──────────────────────────────────────────── */}
      <Section icon={<BarChartRounded />} title="Аналитический отчёт (сводный)">
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Три листа: средний балл по группам и дисциплинам, рейтинг студентов, сводка по посещаемости.
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <SelectField label="Группа" value={anlGroup} onChange={setAnlGroup}>
            <MenuItem value="">Все группы</MenuItem>
            {groups.map(g => <MenuItem key={g.id} value={String(g.id)}>{g.name}</MenuItem>)}
          </SelectField>
          <SelectField label="Дисциплина" value={anlSubject} onChange={setAnlSubject}>
            <MenuItem value="">Все дисциплины</MenuItem>
            {subjects.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>)}
          </SelectField>
          <TextField
            label="Уч. год" size="small" value={anlYear}
            onChange={e => setAnlYear(e.target.value)}
            placeholder="2024-2025" sx={{ minWidth: 130 }}
          />
        </Stack>
        <Box mt={2}>
          <DownloadBtn
            label="Excel" icon={<TableChartRounded fontSize="small" />}
            loading={busy === 'anl-xlsx'}
            onClick={() => run('anl-xlsx', () => downloadAnalyticsExcel({
              group_id: anlGroup ? Number(anlGroup) : undefined,
              subject_id: anlSubject ? Number(anlSubject) : undefined,
              acad_year: anlYear || undefined,
            }))}
          />
        </Box>
      </Section>
    </Box>
  )
}

function Section({ icon, title, children }: { icon: React.ReactElement; title: string; children: React.ReactNode }) {
  return (
    <Paper elevation={1} sx={{ overflow: 'hidden' }}>
      <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
        <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>
      </Box>
      <Box sx={{ px: 3, py: 2.5 }}>{children}</Box>
    </Paper>
  )
}

function SelectField({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <TextField
      select label={label} size="small" value={value}
      onChange={e => onChange(e.target.value)} sx={{ minWidth: 175 }}
    >
      {children}
    </TextField>
  )
}

function DownloadBtn({ label, icon, color = 'primary', loading, onClick }: {
  label: string; icon: React.ReactElement; color?: 'primary' | 'error'
  loading: boolean; onClick: () => void
}) {
  return (
    <Button
      variant="contained" color={color} size="small"
      startIcon={loading ? <CircularProgress size={14} color="inherit" /> : icon}
      onClick={onClick} disabled={loading}
    >
      {loading ? 'Формирую...' : `Скачать ${label}`}
    </Button>
  )
}
