import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, Chip, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell,
  TextField, Button, InputAdornment, Dialog, DialogTitle,
  DialogContent, DialogActions, Select, MenuItem,
} from '@mui/material'
import { SearchRounded, AddRounded } from '@mui/icons-material'
import client from '../../api/client'
import { getSubjects, getMyTeacherProfile, getAssignments } from '../../api/resources'
import type { Subject } from '../../api/resources'

interface TestOut {
  id: number
  title: string
  subject_id: number
  status: 'draft' | 'published' | 'archived'
  time_limit_minutes: number | null
  attempts_allowed: number
  passing_score_pct: number
  created_at: string
}

const STATUS_SX: Record<string, { bgcolor: string; color: string }> = {
  draft:     { bgcolor: '#F1F5F9', color: '#64748b' },
  published: { bgcolor: '#D4EDDF', color: '#347856' },
  archived:  { bgcolor: '#FEF3C7', color: '#92400E' },
}
const STATUS_LABEL: Record<string, string> = { draft: 'Черновик', published: 'Опубликован', archived: 'Архив' }

export default function TestsPage() {
  const navigate = useNavigate()
  const [tests, setTests] = useState<TestOut[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [mySubjects, setMySubjects] = useState<Subject[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [pickedSubjectId, setPickedSubjectId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    Promise.all([
      client.get<TestOut[]>('/tests').then(r => r.data),
      getSubjects(),
      getMyTeacherProfile()
        .then(t => getAssignments(t.id))
        .then(asgns => [...new Set(asgns.map(a => a.subject_id))])
        .catch(() => [] as number[]),
    ]).then(([t, allSubs, mySubjectIds]) => {
      setTests(t)
      setSubjects(allSubs)
      const mine = allSubs.filter(s => mySubjectIds.includes(s.id))
      setMySubjects(mine)
      if (mine.length > 0) setPickedSubjectId(mine[0].id)
    }).finally(() => setLoading(false))
  }, [])

  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s.name]))
  const filtered = tests.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (subjectMap[t.subject_id] ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = () => {
    if (!mySubjects.length) return alert('У вас нет назначенных предметов')
    setShowPicker(true)
  }

  const confirmCreate = async () => {
    if (!pickedSubjectId) return
    setCreating(true)
    try {
      const { data } = await client.post<TestOut>('/tests', { subject_id: pickedSubjectId, title: 'Новый тест', passing_score_pct: 60, attempts_allowed: 1 })
      navigate(`/tests/${data.id}`)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(msg ?? 'Ошибка создания теста')
    } finally { setCreating(false); setShowPicker(false) }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>

  return (
    <Box sx={{ p: 4, maxWidth: 900 }}>
      {/* Subject picker dialog */}
      <Dialog open={showPicker} onClose={() => setShowPicker(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Выберите предмет</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Тест будет создан по выбранному предмету
          </Typography>
          <Select
            fullWidth
            size="small"
            value={pickedSubjectId ?? ''}
            onChange={e => setPickedSubjectId(Number(e.target.value))}
          >
            {mySubjects.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </Select>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setShowPicker(false)}>Отмена</Button>
          <Button variant="contained" disabled={creating || !pickedSubjectId} onClick={confirmCreate}>
            {creating ? 'Создание...' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Тесты</Typography>
          <Typography variant="body2" color="text.secondary">Всего: {tests.length}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Поиск..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> } }}
            sx={{ width: 200 }}
          />
          <Button variant="contained" startIcon={<AddRounded />} onClick={handleCreate} disabled={creating}>
            Создать тест
          </Button>
        </Box>
      </Box>

      {filtered.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">{tests.length === 0 ? 'Тестов пока нет. Создайте первый!' : 'Ничего не найдено'}</Typography>
        </Paper>
      ) : (
        <Paper elevation={2} sx={{ overflow: 'hidden' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Название</TableCell>
                <TableCell>Предмет</TableCell>
                <TableCell align="center">Статус</TableCell>
                <TableCell align="right">Время</TableCell>
                <TableCell align="right">Попытки</TableCell>
                <TableCell align="right">Порог</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(t => (
                <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/tests/${t.id}`)}>
                  <TableCell sx={{ fontWeight: 500 }}>{t.title}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{subjectMap[t.subject_id] ?? '—'}</TableCell>
                  <TableCell align="center">
                    <Chip label={STATUS_LABEL[t.status]} size="small" sx={STATUS_SX[t.status]} />
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary' }}>
                    {t.time_limit_minutes ? `${t.time_limit_minutes} мин` : '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary' }}>{t.attempts_allowed}</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary' }}>{t.passing_score_pct}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  )
}
