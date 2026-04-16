import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, TextField, Button, Alert, Chip,
  Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Stack, IconButton, InputAdornment, CircularProgress,
} from '@mui/material'
import { SearchRounded, EditRounded, DeleteRounded, AddRounded } from '@mui/icons-material'
import client from '../../api/client'
import type { Subject, Department } from '../../api/resources'
import { createDepartment, updateDepartment, deleteDepartment } from '../../api/resources'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'
import { PEACH, WARM } from '../../theme'

interface DeptRow extends Department { subjectCount: number; groupCount: number }
interface GrpShort { id: number; name: string; department_id: number | null }

export default function DepartmentsPage() {
  const navigate = useNavigate()
  const [rows, setRows]         = useState<DeptRow[]>([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<{ mode: 'create' | 'edit'; dept?: Department } | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    const [depts, subjects, groups] = await Promise.all([
      client.get<Department[]>('/departments').then(r => r.data),
      client.get<Subject[]>('/subjects').then(r => r.data),
      client.get<GrpShort[]>('/groups').then(r => r.data),
    ])
    const subjectCount: Record<number, number> = {}
    for (const s of subjects) if (s.department_id) subjectCount[s.department_id] = (subjectCount[s.department_id] ?? 0) + 1
    const groupCount: Record<number, number> = {}
    for (const g of groups) if (g.department_id) groupCount[g.department_id] = (groupCount[g.department_id] ?? 0) + 1
    setRows(depts.map(d => ({ ...d, subjectCount: subjectCount[d.id] ?? 0, groupCount: groupCount[d.id] ?? 0 })))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = rows.filter(d =>
    `${d.name} ${d.code ?? ''} ${d.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, (d, key) => {
    if (key === 'name')     return d.name
    if (key === 'code')     return d.code ?? ''
    if (key === 'subjects') return d.subjectCount
    if (key === 'groups')   return d.groupCount
    return ''
  })

  const handleDelete = async () => {
    if (deleteId === null) return
    await deleteDepartment(deleteId)
    setDeleteId(null)
    load()
  }

  if (loading) return <Spin />

  return (
    <Box sx={{ p: 4, maxWidth: 1000 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Кафедры</Typography>
          <Typography variant="body2" color="text.secondary">Всего: {rows.length}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField
            size="small" placeholder="Поиск по названию или коду..."
            value={search} onChange={e => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> } }}
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
                <SortableHeader label="Кафедра"    sortKey="name"     currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Код"        sortKey="code"     currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Дисциплин"  sortKey="subjects" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                <SortableHeader label="Групп"      sortKey="groups"   currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map(d => (
                <TableRow key={d.id} hover>
                  <TableCell sx={{ cursor: 'pointer' }} onClick={() => navigate(`/departments/${d.id}`)}>
                    <Typography variant="body2" fontWeight={500}>{d.name}</Typography>
                    {d.description && <Typography variant="caption" color="text.secondary">{d.description.slice(0, 60)}{d.description.length > 60 ? '…' : ''}</Typography>}
                  </TableCell>
                  <TableCell sx={{ cursor: 'pointer' }} onClick={() => navigate(`/departments/${d.id}`)}>
                    {d.code
                      ? <Chip label={d.code} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11 }} />
                      : <Typography variant="body2" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ cursor: 'pointer' }} onClick={() => navigate(`/departments/${d.id}`)}>
                    {d.subjectCount > 0
                      ? <Chip label={d.subjectCount} size="small" sx={{ bgcolor: PEACH[50], color: PEACH[700] }} />
                      : <Typography variant="body2" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ cursor: 'pointer' }} onClick={() => navigate(`/departments/${d.id}`)}>
                    {d.groupCount > 0
                      ? <Chip label={d.groupCount} size="small" sx={{ bgcolor: '#D4EDDF', color: '#347856' }} />
                      : <Typography variant="body2" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setModal({ mode: 'edit', dept: d })}
                      sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
                      <EditRounded fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => setDeleteId(d.id)}
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
        <DepartmentModal mode={modal.mode} dept={modal.dept}
          onClose={() => setModal(null)} onSave={() => { setModal(null); load() }} />
      )}
      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Удалить кафедру?</DialogTitle>
        <DialogContent><Typography variant="body2" color="text.secondary">Это действие необратимо.</Typography></DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleteId(null)}>Отмена</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Удалить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function DepartmentModal({ mode, dept, onClose, onSave }: {
  mode: 'create' | 'edit'; dept?: Department; onClose: () => void; onSave: () => void
}) {
  const [name, setName]               = useState(dept?.name ?? '')
  const [code, setCode]               = useState(dept?.code ?? '')
  const [description, setDescription] = useState(dept?.description ?? '')
  const [error, setError]             = useState('')
  const [saving, setSaving]           = useState(false)

  const submit = async () => {
    if (!name.trim()) { setError('Название обязательно'); return }
    setSaving(true); setError('')
    try {
      const payload = { name: name.trim(), code: code.trim() || undefined, description: description.trim() || undefined }
      if (mode === 'create') await createDepartment(payload)
      else await updateDepartment(dept!.id, payload)
      onSave()
    } catch (e: any) { setError(e?.response?.data?.detail ?? 'Ошибка сохранения'); setSaving(false) }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'create' ? 'Новая кафедра' : 'Редактировать кафедру'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Название" size="small" fullWidth value={name} onChange={e => setName(e.target.value)} />
          <TextField label="Код (необязательно)" size="small" fullWidth value={code} onChange={e => setCode(e.target.value)}
            inputProps={{ style: { fontFamily: 'monospace' } }} />
          <TextField label="Описание (необязательно)" size="small" fullWidth multiline rows={3}
            value={description} onChange={e => setDescription(e.target.value)} />
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
