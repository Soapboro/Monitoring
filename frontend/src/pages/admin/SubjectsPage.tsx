import { useEffect, useState } from 'react'
import {
  Box, Paper, Typography, TextField, Button, Alert, Chip,
  Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Stack, MenuItem, IconButton, InputAdornment, CircularProgress,
} from '@mui/material'
import { SearchRounded, EditRounded, DeleteRounded, AddRounded } from '@mui/icons-material'
import type { Subject, Department } from '../../api/resources'
import { getSubjects, getDepartments, createSubject, updateSubject, deleteSubject } from '../../api/resources'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'
import { PEACH } from '../../theme'

export default function SubjectsPage() {
  const [subjects, setSubjects]       = useState<Subject[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(true)
  const [modal, setModal]   = useState<{ mode: 'create' | 'edit'; subject?: Subject } | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([getSubjects(), getDepartments()])
      .then(([s, d]) => { setSubjects(s); setDepartments(d) })
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const deptName = (id: number | null) => departments.find(d => d.id === id)?.name ?? '—'

  const filtered = subjects.filter(s =>
    `${s.name} ${s.code ?? ''} ${deptName(s.department_id)}`.toLowerCase().includes(search.toLowerCase())
  )
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, (s, key) => {
    if (key === 'name')  return s.name
    if (key === 'code')  return s.code ?? ''
    if (key === 'hours') return s.hours_total ?? -1
    if (key === 'dept')  return deptName(s.department_id)
    return ''
  })

  const handleDelete = async () => {
    if (deleteId === null) return
    await deleteSubject(deleteId)
    setDeleteId(null)
    load()
  }

  if (loading) return <Spin />

  return (
    <Box sx={{ p: 4, maxWidth: 900 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Дисциплины</Typography>
          <Typography variant="body2" color="text.secondary">Всего: {subjects.length}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField
            size="small" placeholder="Поиск по названию или кафедре..."
            value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> }}
            sx={{ width: 280 }}
          />
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => setModal({ mode: 'create' })}>
            Создать
          </Button>
        </Box>
      </Box>

      {sorted.length === 0 ? <Empty text="Ничего не найдено" /> : (
        <Paper elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <SortableHeader label="Название" sortKey="name"  currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Код"      sortKey="code"  currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Кафедра"  sortKey="dept"  currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Часов"    sortKey="hours" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map(s => (
                <TableRow key={s.id} hover>
                  <TableCell><Typography variant="body2" fontWeight={500}>{s.name}</Typography></TableCell>
                  <TableCell>
                    {s.code
                      ? <Chip label={s.code} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11 }} />
                      : <Typography variant="body2" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{deptName(s.department_id)}</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary' }}>{s.hours_total ?? '—'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setModal({ mode: 'edit', subject: s })}
                      sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
                      <EditRounded fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => setDeleteId(s.id)}
                      sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                      <DeleteRounded fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {modal && (
        <SubjectModal mode={modal.mode} subject={modal.subject} departments={departments}
          onClose={() => setModal(null)} onSave={() => { setModal(null); load() }} />
      )}
      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Удалить дисциплину?</DialogTitle>
        <DialogContent><Typography variant="body2" color="text.secondary">Это действие необратимо.</Typography></DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleteId(null)}>Отмена</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Удалить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function SubjectModal({ mode, subject, departments, onClose, onSave }: {
  mode: 'create' | 'edit'; subject?: Subject; departments: Department[]; onClose: () => void; onSave: () => void
}) {
  const [name, setName]           = useState(subject?.name ?? '')
  const [code, setCode]           = useState(subject?.code ?? '')
  const [hoursTotal, setHours]    = useState(subject?.hours_total?.toString() ?? '')
  const [departmentId, setDeptId] = useState(subject?.department_id?.toString() ?? '')
  const [error, setError]         = useState('')
  const [saving, setSaving]       = useState(false)

  const submit = async () => {
    if (!name.trim()) { setError('Название обязательно'); return }
    setSaving(true); setError('')
    try {
      const payload = { name: name.trim(), code: code.trim() || undefined, hours_total: hoursTotal ? parseInt(hoursTotal) : undefined, department_id: departmentId ? parseInt(departmentId) : undefined }
      if (mode === 'create') await createSubject(payload)
      else await updateSubject(subject!.id, payload)
      onSave()
    } catch (e: any) { setError(e?.response?.data?.detail ?? 'Ошибка сохранения'); setSaving(false) }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'create' ? 'Новая дисциплина' : 'Редактировать дисциплину'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Название" size="small" fullWidth value={name} onChange={e => setName(e.target.value)} />
          <TextField label="Код (необязательно)" size="small" fullWidth value={code} onChange={e => setCode(e.target.value)}
            inputProps={{ style: { fontFamily: 'monospace' } }} />
          <TextField label="Количество часов" type="number" size="small" fullWidth value={hoursTotal}
            onChange={e => setHours(e.target.value)} inputProps={{ min: 0 }} />
          <TextField select label="Кафедра (необязательно)" size="small" fullWidth value={departmentId}
            onChange={e => setDeptId(e.target.value)}>
            <MenuItem value="">— не указана —</MenuItem>
            {departments.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
          </TextField>
          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} variant="outlined">Отмена</Button>
        <Button onClick={submit} variant="contained" disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const Spin = () => (
  <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress color="primary" /></Box>
)
const Empty = ({ text }: { text: string }) => (
  <Paper sx={{ p: 6, textAlign: 'center' }}><Typography color="text.secondary">{text}</Typography></Paper>
)
