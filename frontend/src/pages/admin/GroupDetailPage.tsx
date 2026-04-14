import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, Button, Chip, Avatar, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Stack, Alert, FormControlLabel, Checkbox,
  Breadcrumbs, Link as MuiLink,
} from '@mui/material'
import { AddRounded, ChevronRightRounded } from '@mui/icons-material'
import client from '../../api/client'
import type { StudentProfile, Group } from '../../api/resources'
import { getAllStudents, transferStudent, getGroups } from '../../api/resources'
import { PEACH, WARM } from '../../theme'

export default function GroupDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [group, setGroup]       = useState<Group | null>(null)
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [loading, setLoading]   = useState(true)
  const [addOpen, setAddOpen]   = useState(false)
  const [transferTarget, setTransferTarget] = useState<StudentProfile | null>(null)

  const load = () => {
    if (!id) return
    setLoading(true)
    Promise.all([
      client.get<Group>(`/groups/${id}`).then(r => r.data),
      client.get<StudentProfile[]>('/students', { params: { group_id: id } }).then(r => r.data),
    ]).then(([g, s]) => { setGroup(g); setStudents(s) }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [id])

  if (loading) return <Spin />
  if (!group) return <Box sx={{ p: 4, color: 'text.secondary' }}>Группа не найдена</Box>

  return (
    <Box sx={{ p: 4, maxWidth: 900 }}>
      <Breadcrumbs sx={{ mb: 3 }} separator={<ChevronRightRounded sx={{ fontSize: 14 }} />}>
        <MuiLink underline="hover" color="primary" sx={{ cursor: 'pointer', fontSize: 13 }} onClick={() => navigate('/groups')}>
          Группы
        </MuiLink>
        <Typography sx={{ fontSize: 13, color: WARM[700] }}>{group.name}</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{group.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Год набора: {group.year_start} · Студентов: {students.length}
          </Typography>
        </Box>
        <Chip label={group.is_active ? 'Активна' : 'Неактивна'} size="small"
          sx={group.is_active ? { bgcolor: '#D4EDDF', color: '#347856' } : { bgcolor: '#F5EDEA', color: WARM[500] }} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>Список студентов</Typography>
        <Button size="small" startIcon={<AddRounded />} variant="outlined" onClick={() => setAddOpen(true)}>
          Добавить студента
        </Button>
      </Box>

      {students.length === 0 ? <Empty text="Студентов в группе нет" /> : (
        <Paper elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }}>#</TableCell>
                <TableCell>ФИО</TableCell>
                <TableCell>№ студ.</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map((s, i) => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ color: 'text.disabled', cursor: 'pointer' }} onClick={() => navigate(`/students/${s.id}`)}>{i + 1}</TableCell>
                  <TableCell sx={{ cursor: 'pointer' }} onClick={() => navigate(`/students/${s.id}`)}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: 12, fontWeight: 700, bgcolor: PEACH[100], color: PEACH[700] }}>
                        {s.last_name[0]}
                      </Avatar>
                      <Typography variant="body2" fontWeight={500}>{s.last_name} {s.first_name} {s.middle_name ?? ''}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', cursor: 'pointer' }} onClick={() => navigate(`/students/${s.id}`)}>{s.student_num ?? '—'}</TableCell>
                  <TableCell sx={{ cursor: 'pointer' }} onClick={() => navigate(`/students/${s.id}`)}>
                    <Chip label={s.is_active ? 'Активен' : 'Неактивен'} size="small"
                      sx={s.is_active ? { bgcolor: '#D4EDDF', color: '#347856' } : { bgcolor: '#F5EDEA', color: WARM[500] }} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="text" sx={{ fontSize: 12, color: 'text.secondary' }}
                      onClick={() => setTransferTarget(s)}>
                      Перевести
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {addOpen && (
        <AddStudentsModal currentGroupId={group.id} onClose={() => setAddOpen(false)} onSave={() => { setAddOpen(false); load() }} />
      )}
      {transferTarget && (
        <TransferStudentModal student={transferTarget} currentGroupId={group.id}
          onClose={() => setTransferTarget(null)} onSave={() => { setTransferTarget(null); load() }} />
      )}
    </Box>
  )
}

function AddStudentsModal({ currentGroupId, onClose, onSave }: {
  currentGroupId: number; onClose: () => void; onSave: () => void
}) {
  const [items, setItems]       = useState<StudentProfile[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    getAllStudents().then(all => setItems(all.filter(s => s.group_id !== currentGroupId))).finally(() => setLoading(false))
  }, [])

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const filtered = items.filter(s =>
    `${s.last_name} ${s.first_name} ${s.middle_name ?? ''} ${s.student_num ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )
  const submit = async () => {
    setSaving(true)
    try { await Promise.all([...selected].map(id => transferStudent(id, currentGroupId))); onSave() }
    catch { setSaving(false) }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Добавить студентов в группу</DialogTitle>
      <DialogContent>
        <TextField size="small" fullWidth placeholder="Поиск по ФИО или номеру..."
          value={search} onChange={e => setSearch(e.target.value)} sx={{ mb: 2, mt: 1 }} />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} color="primary" /></Box>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>Нет доступных студентов</Typography>
        ) : (
          <Box sx={{ maxHeight: 280, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            {filtered.map(s => (
              <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, '&:hover': { bgcolor: 'action.hover' }, cursor: 'pointer' }}
                onClick={() => toggle(s.id)}>
                <FormControlLabel
                  control={<Checkbox size="small" checked={selected.has(s.id)} onChange={() => toggle(s.id)} onClick={e => e.stopPropagation()} />}
                  label={<Typography variant="body2">{s.last_name} {s.first_name} {s.middle_name ?? ''}</Typography>}
                  sx={{ flex: 1, m: 0 }}
                />
                {s.student_num && <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.disabled' }}>{s.student_num}</Typography>}
              </Box>
            ))}
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>Выбрано: {selected.size}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} variant="outlined">Отмена</Button>
        <Button onClick={submit} variant="contained" disabled={saving || selected.size === 0}>
          {saving ? 'Добавление...' : `Добавить (${selected.size})`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function TransferStudentModal({ student, currentGroupId, onClose, onSave }: {
  student: StudentProfile; currentGroupId: number; onClose: () => void; onSave: () => void
}) {
  const [groups, setGroups] = useState<Group[]>([])
  const [targetId, setTargetId] = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    getGroups().then(all => setGroups(all.filter(g => g.id !== currentGroupId))).finally(() => setLoading(false))
  }, [])

  const submit = async () => {
    if (!targetId) { setError('Выберите группу'); return }
    setSaving(true)
    try { await transferStudent(student.id, parseInt(targetId)); onSave() }
    catch (e: any) { setError(e?.response?.data?.detail ?? 'Ошибка'); setSaving(false) }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Перевести студента</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {student.last_name} {student.first_name} {student.middle_name ?? ''}
        </Typography>
        {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={20} color="primary" /></Box> : (
          <TextField select label="Новая группа" size="small" fullWidth value={targetId} onChange={e => setTargetId(e.target.value)}>
            <MenuItem value="">— выберите группу —</MenuItem>
            {groups.map(g => <MenuItem key={g.id} value={g.id}>{g.name} ({g.year_start})</MenuItem>)}
          </TextField>
        )}
        {error && <Alert severity="error" sx={{ mt: 2, py: 0.5 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} variant="outlined">Отмена</Button>
        <Button onClick={submit} variant="contained" disabled={saving || !targetId}>
          {saving ? 'Перевод...' : 'Перевести'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const Spin  = () => <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress color="primary" /></Box>
const Empty = ({ text }: { text: string }) => (
  <Paper sx={{ p: 6, textAlign: 'center' }}><Typography color="text.secondary">{text}</Typography></Paper>
)
