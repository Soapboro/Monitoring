import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, Chip, CircularProgress, Breadcrumbs, Link,
  Table, TableHead, TableBody, TableRow, TableCell,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Checkbox, FormControlLabel, Alert, IconButton, InputAdornment,
} from '@mui/material'
import { ChevronRightRounded, DeleteOutlineRounded, AddRounded, SearchRounded } from '@mui/icons-material'
import client from '../../api/client'
import type { Subject, Department, Group, TeacherProfile } from '../../api/resources'
import { updateSubject, updateGroup, getAllTeachers, setTeacherDepartment } from '../../api/resources'
import { WARM } from '../../theme'

export default function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [dept, setDept] = useState<Department | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [teachers, setTeachers] = useState<TeacherProfile[]>([])
  const [loading, setLoading] = useState(true)

  const [addSubjectsOpen, setAddSubjectsOpen] = useState(false)
  const [addGroupsOpen, setAddGroupsOpen] = useState(false)
  const [addTeachersOpen, setAddTeachersOpen] = useState(false)

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [d, subjs, allGroups, deptTeachers] = await Promise.all([
        client.get<Department>(`/departments/${id}`).then(r => r.data),
        client.get<Subject[]>('/subjects', { params: { department_id: id } }).then(r => r.data),
        client.get<Group[]>('/groups').then(r => r.data),
        client.get<TeacherProfile[]>('/teachers', { params: { department_id: id } }).then(r => r.data),
      ])
      setDept(d)
      setSubjects(subjs.sort((a, b) => a.name.localeCompare(b.name)))
      setGroups(allGroups.filter(g => g.department_id === d.id).sort((a, b) => a.name.localeCompare(b.name)))
      setTeachers(deptTeachers.sort((a, b) => a.last_name.localeCompare(b.last_name)))
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const removeSubject = async (subject: Subject) => { await updateSubject(subject.id, { department_id: null }); load() }
  const removeGroup = async (group: Group) => { await updateGroup(group.id, { department_id: null }); load() }
  const removeTeacher = async (teacher: TeacherProfile) => { await setTeacherDepartment(teacher.id, null); load() }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
  if (!dept) return <Typography sx={{ p: 4 }} color="text.secondary">Кафедра не найдена</Typography>

  return (
    <Box sx={{ p: 4, maxWidth: 900 }}>
      <Breadcrumbs separator={<ChevronRightRounded sx={{ fontSize: 14 }} />} sx={{ mb: 3, fontSize: 13 }}>
        <Link underline="hover" sx={{ cursor: 'pointer' }} color="inherit" onClick={() => navigate('/departments')}>Кафедры</Link>
        <Typography fontSize={13} color="text.primary" fontWeight={500}>{dept.name}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={600}>{dept.name}</Typography>
            {dept.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{dept.description}</Typography>}
          </Box>
          {dept.code && (
            <Chip label={dept.code} size="small" sx={{ fontFamily: 'monospace', bgcolor: '#DBEAFE', color: '#1D4ED8', flexShrink: 0 }} />
          )}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mt: 2.5, pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Дисциплин</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: WARM[800] }}>{subjects.length}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Групп</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: WARM[800] }}>{groups.length}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Преподавателей</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: WARM[800] }}>{teachers.length}</Typography>
          </Box>
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Группы */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>Группы</Typography>
              <Typography variant="caption" color="text.disabled">{groups.length}</Typography>
            </Box>
            <Button size="small" startIcon={<AddRounded />} onClick={() => setAddGroupsOpen(true)}>Добавить группу</Button>
          </Box>
          {groups.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center' }}><Typography color="text.secondary">Групп нет</Typography></Paper>
          ) : (
            <Paper elevation={2} sx={{ overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Группа</TableCell>
                    <TableCell>Набор</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell sx={{ width: 48 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groups.map(g => (
                    <TableRow key={g.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/groups/${g.id}`)}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Typography variant="caption" fontWeight={700} sx={{ color: '#065F46' }}>{g.name[0]}</Typography>
                          </Box>
                          <Typography variant="body2" fontWeight={500}>{g.name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{g.year_start}</TableCell>
                      <TableCell>
                        <Chip
                          label={g.is_active ? 'Активна' : 'Неактивна'}
                          size="small"
                          sx={g.is_active ? { bgcolor: '#D1FAE5', color: '#065F46' } : { bgcolor: '#F1F5F9', color: '#64748b' }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={e => { e.stopPropagation(); removeGroup(g) }}
                          sx={{ color: 'text.disabled', '&:hover': { color: 'error.main', bgcolor: '#FEF2F2' } }}>
                          <DeleteOutlineRounded sx={{ fontSize: 18 }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </Box>

        {/* Дисциплины */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>Дисциплины</Typography>
              <Typography variant="caption" color="text.disabled">{subjects.length}</Typography>
            </Box>
            <Button size="small" startIcon={<AddRounded />} onClick={() => setAddSubjectsOpen(true)}>Добавить дисциплину</Button>
          </Box>
          {subjects.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center' }}><Typography color="text.secondary">Дисциплин нет</Typography></Paper>
          ) : (
            <Paper elevation={2} sx={{ overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Код</TableCell>
                    <TableCell align="right">Часов</TableCell>
                    <TableCell sx={{ width: 48 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {subjects.map(s => (
                    <TableRow key={s.id} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{s.name}</TableCell>
                      <TableCell sx={{ color: 'text.disabled', fontFamily: 'monospace', fontSize: 12 }}>{s.code ?? '—'}</TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>{s.hours_total ?? '—'}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => removeSubject(s)}
                          sx={{ color: 'text.disabled', '&:hover': { color: 'error.main', bgcolor: '#FEF2F2' } }}>
                          <DeleteOutlineRounded sx={{ fontSize: 18 }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </Box>

        {/* Преподаватели */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>Преподаватели</Typography>
              <Typography variant="caption" color="text.disabled">{teachers.length}</Typography>
            </Box>
            <Button size="small" startIcon={<AddRounded />} onClick={() => setAddTeachersOpen(true)}>Добавить преподавателя</Button>
          </Box>
          {teachers.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center' }}><Typography color="text.secondary">Преподавателей нет</Typography></Paper>
          ) : (
            <Paper elevation={2} sx={{ overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ФИО</TableCell>
                    <TableCell>Должность</TableCell>
                    <TableCell>Телефон</TableCell>
                    <TableCell sx={{ width: 48 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {teachers.map(t => (
                    <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/teachers/${t.id}`)}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Typography variant="caption" fontWeight={700} sx={{ color: '#6D28D9' }}>{t.last_name[0]}</Typography>
                          </Box>
                          <Typography variant="body2" fontWeight={500}>{t.last_name} {t.first_name} {t.middle_name ?? ''}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{t.position ?? '—'}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{t.phone ?? '—'}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={e => { e.stopPropagation(); removeTeacher(t) }}
                          sx={{ color: 'text.disabled', '&:hover': { color: 'error.main', bgcolor: '#FEF2F2' } }}>
                          <DeleteOutlineRounded sx={{ fontSize: 18 }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </Box>
      </Box>

      {addSubjectsOpen && (
        <AddItemsModal
          title="Добавить дисциплины в кафедру"
          fetchItems={async () => {
            const all = await client.get<Subject[]>('/subjects').then(r => r.data)
            return all.filter(s => s.department_id !== dept.id).map(s => ({ id: s.id, label: s.name, sub: s.code ?? undefined }))
          }}
          onAdd={async (ids) => { await Promise.all(ids.map(id => updateSubject(id, { department_id: dept.id }))) }}
          onClose={() => setAddSubjectsOpen(false)}
          onSave={() => { setAddSubjectsOpen(false); load() }}
        />
      )}

      {addGroupsOpen && (
        <AddItemsModal
          title="Добавить группы в кафедру"
          fetchItems={async () => {
            const all = await client.get<Group[]>('/groups').then(r => r.data)
            return all.filter(g => g.department_id !== dept.id).map(g => ({ id: g.id, label: g.name, sub: String(g.year_start) }))
          }}
          onAdd={async (ids) => { await Promise.all(ids.map(id => updateGroup(id, { department_id: dept.id }))) }}
          onClose={() => setAddGroupsOpen(false)}
          onSave={() => { setAddGroupsOpen(false); load() }}
        />
      )}

      {addTeachersOpen && (
        <AddTeachersModal
          deptId={dept.id}
          onClose={() => setAddTeachersOpen(false)}
          onSave={() => { setAddTeachersOpen(false); load() }}
        />
      )}
    </Box>
  )
}

function AddTeachersModal({ deptId, onClose, onSave }: {
  deptId: number; onClose: () => void; onSave: () => void
}) {
  const [items, setItems] = useState<(TeacherProfile & { currentDeptName?: string })[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getAllTeachers(), client.get<Department[]>('/departments').then(r => r.data)])
      .then(([teachers, depts]) => {
        const deptMap = Object.fromEntries(depts.map(d => [d.id, d.name]))
        setItems(
          teachers
            .filter(t => t.department_id !== deptId)
            .map(t => ({ ...t, currentDeptName: t.department_id ? deptMap[t.department_id] : undefined }))
        )
      })
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const filtered = items.filter(t =>
    `${t.last_name} ${t.first_name} ${t.middle_name ?? ''} ${t.position ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )

  const submit = async () => {
    if (selected.size === 0) return
    setSaving(true)
    try { await Promise.all([...selected].map(id => setTeacherDepartment(id, deptId))); onSave() }
    catch { setSaving(false) }
  }

  const hasTransfers = [...selected].some(id => items.find(t => t.id === id)?.currentDeptName)

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Добавить преподавателей в кафедру</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth size="small" placeholder="Поиск по ФИО или должности..." value={search}
          onChange={e => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> } }}
          sx={{ mt: 1, mb: 1.5 }}
        />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>Нет доступных преподавателей</Typography>
        ) : (
          <Box sx={{ maxHeight: 280, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            {filtered.map(t => (
              <Box
                key={t.id}
                sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 }, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                onClick={() => toggle(t.id)}
              >
                <Checkbox checked={selected.has(t.id)} size="small" sx={{ mr: 1, p: 0.5 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2">{t.last_name} {t.first_name} {t.middle_name ?? ''}</Typography>
                  {t.position && <Typography variant="caption" color="text.disabled">{t.position}</Typography>}
                </Box>
                {t.currentDeptName
                  ? <Chip label={`← ${t.currentDeptName}`} size="small" sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontSize: 11, ml: 1, flexShrink: 0 }} />
                  : <Typography variant="caption" color="text.disabled" sx={{ ml: 1, flexShrink: 0 }}>без кафедры</Typography>
                }
              </Box>
            ))}
          </Box>
        )}
        {hasTransfers && (
          <Alert severity="warning" sx={{ mt: 1.5, fontSize: 12 }}>
            Отмеченные преподаватели с указанием кафедры будут переведены из неё в текущую.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
        <Typography variant="caption" color="text.disabled">Выбрано: {selected.size}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button color="inherit" onClick={onClose}>Отмена</Button>
          <Button variant="contained" disabled={saving || selected.size === 0} onClick={submit}>
            {saving ? 'Добавление...' : `Добавить (${selected.size})`}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  )
}

interface PickItem { id: number; label: string; sub?: string }

function AddItemsModal({ title, fetchItems, onAdd, onClose, onSave }: {
  title: string
  fetchItems: () => Promise<PickItem[]>
  onAdd: (ids: number[]) => Promise<void>
  onClose: () => void
  onSave: () => void
}) {
  const [items, setItems] = useState<PickItem[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchItems().then(setItems).finally(() => setLoading(false)) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const filtered = items.filter(i => i.label.toLowerCase().includes(search.toLowerCase()))

  const submit = async () => {
    if (selected.size === 0) return
    setSaving(true)
    try { await onAdd([...selected]); onSave() }
    catch { setSaving(false) }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth size="small" placeholder="Поиск..." value={search}
          onChange={e => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> } }}
          sx={{ mt: 1, mb: 1.5 }}
        />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>Ничего не найдено</Typography>
        ) : (
          <Box sx={{ maxHeight: 280, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            {filtered.map(item => (
              <Box
                key={item.id}
                sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 }, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                onClick={() => toggle(item.id)}
              >
                <Checkbox checked={selected.has(item.id)} size="small" sx={{ mr: 1, p: 0.5 }} />
                <Typography variant="body2" sx={{ flex: 1 }}>{item.label}</Typography>
                {item.sub && <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', ml: 1 }}>{item.sub}</Typography>}
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
        <Typography variant="caption" color="text.disabled">Выбрано: {selected.size}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button color="inherit" onClick={onClose}>Отмена</Button>
          <Button variant="contained" disabled={saving || selected.size === 0} onClick={submit}>
            {saving ? 'Добавление...' : `Добавить (${selected.size})`}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  )
}
