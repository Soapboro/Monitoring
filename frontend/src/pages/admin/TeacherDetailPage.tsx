import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, Chip, CircularProgress, Breadcrumbs, Link,
  Table, TableHead, TableBody, TableRow, TableCell,
  Collapse, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, IconButton,
} from '@mui/material'
import { ChevronRightRounded, DeleteOutlineRounded, AddRounded } from '@mui/icons-material'
import client from '../../api/client'
import type { TeacherProfile, TeachingAssignment, Subject, Group } from '../../api/resources'
import { getSubjects, getGroups, createAssignment, deleteAssignment } from '../../api/resources'
import { WARM } from '../../theme'

interface Department { id: number; name: string }
interface GroupAssignments {
  group: Group
  items: { assignment: TeachingAssignment; subject: Subject; deptName: string | null }[]
}

const CONTROL_FORMS = ['Экзамен', 'Зачёт', 'Дифференцированный зачёт', 'Контрольная работа', 'Курсовая работа', 'Реферат']

export default function TeacherDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [teacher, setTeacher] = useState<TeacherProfile | null>(null)
  const [groups, setGroups] = useState<GroupAssignments[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    if (!id) return
    try {
      const [t, assignments] = await Promise.all([
        client.get<TeacherProfile>(`/teachers/${id}`).then(r => r.data),
        client.get<TeachingAssignment[]>('/teaching-assignments', { params: { teacher_id: id } }).then(r => r.data),
      ])
      setTeacher(t)

      const subjectIds = [...new Set(assignments.map(a => a.subject_id))]
      const groupIds = [...new Set(assignments.map(a => a.group_id))]

      const [subjects, grps] = await Promise.all([
        Promise.all(subjectIds.map(sid => client.get<Subject>(`/subjects/${sid}`).then(r => r.data).catch(() => null))),
        Promise.all(groupIds.map(gid => client.get<Group>(`/groups/${gid}`).then(r => r.data).catch(() => null))),
      ])

      const subjectMap: Record<number, Subject> = {}
      for (const s of subjects) if (s) subjectMap[s.id] = s
      const groupMap: Record<number, Group> = {}
      for (const g of grps) if (g) groupMap[g.id] = g

      const deptIds = [...new Set(subjects.map(s => s?.department_id).filter(Boolean) as number[])]
      const deptMap: Record<number, string> = {}
      await Promise.all(deptIds.map(did =>
        client.get<Department>(`/departments/${did}`).then(r => { deptMap[did] = r.data.name }).catch(() => {})
      ))

      const byGroup: Record<number, GroupAssignments> = {}
      for (const a of assignments) {
        const grp = groupMap[a.group_id]
        const subj = subjectMap[a.subject_id]
        if (!grp || !subj) continue
        if (!byGroup[a.group_id]) byGroup[a.group_id] = { group: grp, items: [] }
        byGroup[a.group_id].items.push({ assignment: a, subject: subj, deptName: subj.department_id ? (deptMap[subj.department_id] ?? null) : null })
      }

      const result = Object.values(byGroup).sort((a, b) => a.group.name.localeCompare(b.group.name))
      setGroups(result)
      if (result.length > 0 && expanded === null) setExpanded(result[0].group.id)
    } catch { /* silent */ }
  }

  useEffect(() => { load().finally(() => setLoading(false)) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    if (deleteId === null) return
    setDeleting(true)
    try { await deleteAssignment(deleteId); setDeleteId(null); await load() }
    finally { setDeleting(false) }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
  if (!teacher) return <Typography sx={{ p: 4 }} color="text.secondary">Преподаватель не найден</Typography>

  const fullName = `${teacher.last_name} ${teacher.first_name}${teacher.middle_name ? ' ' + teacher.middle_name : ''}`
  const totalSubjects = groups.reduce((s, g) => s + g.items.length, 0)

  return (
    <Box sx={{ p: 4, maxWidth: 900 }}>
      <Breadcrumbs separator={<ChevronRightRounded sx={{ fontSize: 14 }} />} sx={{ mb: 3, fontSize: 13 }}>
        <Link underline="hover" sx={{ cursor: 'pointer' }} color="inherit" onClick={() => navigate('/teachers')}>Преподаватели</Link>
        <Typography fontSize={13} color="text.primary" fontWeight={500}>{teacher.last_name} {teacher.first_name}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#6D28D9' }}>{teacher.last_name[0]}</Typography>
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={600}>{fullName}</Typography>
            <Typography variant="body2" color="text.secondary">{teacher.position ?? 'Должность не указана'}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mt: 2.5, pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Групп</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: WARM[800] }}>{groups.length}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Назначений</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: WARM[800] }}>{totalSubjects}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Телефон</Typography>
            <Typography variant="body2" fontWeight={500} sx={{ mt: 0.5 }}>{teacher.phone ?? '—'}</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Assignments section header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>Преподаваемые предметы</Typography>
          <Typography variant="caption" color="text.disabled">{groups.length} групп</Typography>
        </Box>
        <Button variant="contained" size="small" startIcon={<AddRounded />} onClick={() => setShowAddModal(true)}>
          Добавить назначение
        </Button>
      </Box>

      {groups.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}><Typography color="text.secondary">Нет назначений</Typography></Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {groups.map(({ group, items }) => {
            const isOpen = expanded === group.id
            return (
              <Paper key={group.id} elevation={1} sx={{ overflow: 'hidden' }}>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  onClick={() => setExpanded(isOpen ? null : group.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <ChevronRightRounded sx={{ fontSize: 16, color: 'text.disabled', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                    <Link
                      underline="hover"
                      sx={{ cursor: 'pointer', fontWeight: 500 }}
                      onClick={e => { e.stopPropagation(); navigate(`/groups/${group.id}`) }}
                    >
                      {group.name}
                    </Link>
                    <Typography variant="caption" color="text.disabled">набор {group.year_start}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.disabled">{items.length} предм.</Typography>
                </Box>

                <Collapse in={isOpen} unmountOnExit>
                  <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Предмет</TableCell>
                          <TableCell>Кафедра</TableCell>
                          <TableCell>Год / сем.</TableCell>
                          <TableCell>Форма контроля</TableCell>
                          <TableCell sx={{ width: 48 }} />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items.map(({ assignment, subject, deptName }) => (
                          <TableRow
                            key={assignment.id}
                            hover
                            sx={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/assignments/${assignment.id}`)}
                          >
                            <TableCell sx={{ fontWeight: 500 }}>{subject.name}</TableCell>
                            <TableCell sx={{ color: 'text.secondary' }}>{deptName ?? '—'}</TableCell>
                            <TableCell sx={{ color: 'text.secondary' }}>{assignment.acad_year} / {assignment.semester}</TableCell>
                            <TableCell sx={{ color: 'text.secondary' }}>{assignment.control_form ?? '—'}</TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                onClick={e => { e.stopPropagation(); setDeleteId(assignment.id) }}
                                sx={{ color: 'text.disabled', '&:hover': { color: 'error.main', bgcolor: '#FEF2F2' } }}
                              >
                                <DeleteOutlineRounded sx={{ fontSize: 18 }} />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                </Collapse>
              </Paper>
            )
          })}
        </Box>
      )}

      {/* Add assignment modal */}
      {showAddModal && teacher && (
        <AddAssignmentModal
          teacherId={teacher.id}
          onClose={() => setShowAddModal(false)}
          onSave={async () => { setShowAddModal(false); await load() }}
        />
      )}

      {/* Confirm delete dialog */}
      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Удалить назначение?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Связанные оценки и посещаемость останутся.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleteId(null)}>Отмена</Button>
          <Button variant="contained" color="error" disabled={deleting} onClick={handleDelete}>
            {deleting ? 'Удаление...' : 'Удалить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function AddAssignmentModal({ teacherId, onClose, onSave }: {
  teacherId: number; onClose: () => void; onSave: () => void
}) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [subjectId, setSubjectId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [acadYear, setAcadYear] = useState(() => { const y = new Date().getFullYear(); return `${y}-${y + 1}` })
  const [semester, setSemester] = useState('1')
  const [controlForm, setControlForm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    Promise.all([getSubjects(), getGroups()])
      .then(([s, g]) => { setSubjects(s); setGroups(g) })
      .finally(() => setLoadingData(false))
  }, [])

  const submit = async () => {
    if (!subjectId) { setError('Выберите предмет'); return }
    if (!groupId) { setError('Выберите группу'); return }
    if (!acadYear.trim()) { setError('Укажите учебный год'); return }
    setSaving(true); setError('')
    try {
      await createAssignment({
        teacher_id: teacherId,
        subject_id: parseInt(subjectId),
        group_id: parseInt(groupId),
        semester: parseInt(semester),
        acad_year: acadYear.trim(),
        ...(controlForm ? { control_form: controlForm } : {}),
      })
      onSave()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Ошибка сохранения')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Новое назначение</DialogTitle>
      <DialogContent>
        {loadingData ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField select label="Предмет" fullWidth size="small" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
              <MenuItem value=""><em>— выберите предмет —</em></MenuItem>
              {subjects.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
            <TextField select label="Группа" fullWidth size="small" value={groupId} onChange={e => setGroupId(e.target.value)}>
              <MenuItem value=""><em>— выберите группу —</em></MenuItem>
              {groups.map(g => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
            </TextField>
            <TextField label="Учебный год" fullWidth size="small" placeholder="2024-2025" value={acadYear} onChange={e => setAcadYear(e.target.value)} />
            <TextField select label="Семестр" fullWidth size="small" value={semester} onChange={e => setSemester(e.target.value)}>
              <MenuItem value="1">1</MenuItem>
              <MenuItem value="2">2</MenuItem>
            </TextField>
            <TextField select label="Форма контроля (необязательно)" fullWidth size="small" value={controlForm} onChange={e => setControlForm(e.target.value)}>
              <MenuItem value=""><em>— не указана —</em></MenuItem>
              {CONTROL_FORMS.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
            </TextField>
            {error && <Alert severity="error">{error}</Alert>}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>Отмена</Button>
        <Button variant="contained" disabled={saving || loadingData} onClick={submit}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
