import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, TextField, Button, Alert, Chip,
  Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Stack, MenuItem, IconButton, InputAdornment, CircularProgress,
} from '@mui/material'
import { SearchRounded, EditRounded, DeleteRounded, AddRounded, ChevronRightRounded } from '@mui/icons-material'
import type { Group, Department } from '../../api/resources'
import { getGroups, getDepartments, createGroup, updateGroup, deleteGroup } from '../../api/resources'
import { ConfirmDelete } from '../../components/CrudHelpers'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'

export default function GroupsPage() {
  const navigate = useNavigate()
  const [groups, setGroups]           = useState<Group[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(true)
  const [modal, setModal]   = useState<{ mode: 'create' | 'edit'; group?: Group } | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([getGroups(), getDepartments()])
      .then(([g, d]) => { setGroups(g); setDepartments(d) })
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const filtered = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, (g, key) => {
    if (key === 'name')       return g.name
    if (key === 'year_start') return g.year_start
    if (key === 'status')     return g.is_active
    return ''
  })

  const handleDelete = async () => {
    if (deleteId === null) return
    await deleteGroup(deleteId)
    setDeleteId(null)
    load()
  }

  if (loading) return <Spin />

  return (
    <Box sx={{ p: 4, maxWidth: 800 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Учебные группы</Typography>
          <Typography variant="body2" color="text.secondary">Всего: {groups.length} · Нажмите для просмотра</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField
            size="small" placeholder="Поиск по названию..."
            value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> }}
            sx={{ width: 220 }}
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
                <SortableHeader label="Название"   sortKey="name"       currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Год начала" sortKey="year_start" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Статус"     sortKey="status"     currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map(g => (
                <TableRow key={g.id} hover>
                  <TableCell sx={{ cursor: 'pointer' }} onClick={() => navigate(`/groups/${g.id}`)}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" fontWeight={500}>{g.name}</Typography>
                      <ChevronRightRounded sx={{ fontSize: 16, color: 'text.disabled' }} />
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', cursor: 'pointer' }} onClick={() => navigate(`/groups/${g.id}`)}>{g.year_start}</TableCell>
                  <TableCell sx={{ cursor: 'pointer' }} onClick={() => navigate(`/groups/${g.id}`)}>
                    <Chip label={g.is_active ? 'Активна' : 'Неактивна'} size="small"
                      sx={g.is_active ? { bgcolor: '#D4EDDF', color: '#347856' } : { bgcolor: '#F5EDEA', color: '#9A6E62' }} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setModal({ mode: 'edit', group: g })}
                      sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
                      <EditRounded fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => setDeleteId(g.id)}
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
        <GroupModal mode={modal.mode} group={modal.group} departments={departments}
          onClose={() => setModal(null)} onSave={() => { setModal(null); load() }} />
      )}
      {deleteId !== null && (
        <ConfirmDelete text="Удалить группу? Это действие необратимо."
          onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
      )}
    </Box>
  )
}

function GroupModal({ mode, group, departments, onClose, onSave }: {
  mode: 'create' | 'edit'; group?: Group; departments: Department[]; onClose: () => void; onSave: () => void
}) {
  const [name, setName]           = useState(group?.name ?? '')
  const [yearStart, setYearStart] = useState(group?.year_start?.toString() ?? new Date().getFullYear().toString())
  const [departmentId, setDeptId] = useState(group?.department_id?.toString() ?? '')
  const [isActive, setIsActive]   = useState(group?.is_active ?? true)
  const [error, setError]         = useState('')
  const [saving, setSaving]       = useState(false)

  const submit = async () => {
    if (!name.trim()) { setError('Название обязательно'); return }
    setSaving(true); setError('')
    try {
      const payload = { name: name.trim(), year_start: parseInt(yearStart), department_id: departmentId ? parseInt(departmentId) : undefined, is_active: isActive }
      if (mode === 'create') await createGroup(payload)
      else await updateGroup(group!.id, payload)
      onSave()
    } catch (e: any) { setError(e?.response?.data?.detail ?? 'Ошибка сохранения'); setSaving(false) }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'create' ? 'Новая группа' : 'Редактировать группу'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Название" size="small" fullWidth value={name} onChange={e => setName(e.target.value)} />
          <TextField label="Год начала" type="number" size="small" fullWidth value={yearStart}
            onChange={e => setYearStart(e.target.value)} inputProps={{ min: 2000, max: 2100 }} />
          <TextField select label="Кафедра (необязательно)" size="small" fullWidth value={departmentId}
            onChange={e => setDeptId(e.target.value)}>
            <MenuItem value="">— не указана —</MenuItem>
            {departments.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
          </TextField>
          <TextField select label="Статус" size="small" fullWidth value={isActive ? 'true' : 'false'}
            onChange={e => setIsActive(e.target.value === 'true')}>
            <MenuItem value="true">Активна</MenuItem>
            <MenuItem value="false">Неактивна</MenuItem>
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
