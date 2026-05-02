import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { AddRounded, DeleteRounded, EditRounded, SearchRounded } from '@mui/icons-material'
import client from '../../api/client'
import { createUser, deleteUser, getDepartments, getGroups, updateUser } from '../../api/resources'
import type { Department, Group, UserCreateData } from '../../api/resources'
import type { UserMe } from '../../api/auth'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'

const ROLE_LABELS: Record<UserMe['role'], string> = {
  admin: 'Администратор',
  teacher: 'Преподаватель',
  student: 'Студент',
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserMe[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; user?: UserMe } | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    client.get<UserMe[]>('/users').then(r => setUsers(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = users.filter(u =>
    `${u.email} ${ROLE_LABELS[u.role]}`.toLowerCase().includes(search.toLowerCase()),
  )
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, (u, key) => {
    if (key === 'email') return u.email
    if (key === 'role') return ROLE_LABELS[u.role]
    if (key === 'status') return u.is_active
    return ''
  })

  const handleDelete = async () => {
    if (deleteId === null) return
    await deleteUser(deleteId)
    setDeleteId(null)
    load()
  }

  if (loading) return <Spin />

  return (
    <Box sx={{ p: 4, maxWidth: 900 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Пользователи</Typography>
          <Typography variant="body2" color="text.secondary">Всего: {users.length}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField
            size="small"
            placeholder="Поиск по email или роли..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded sx={{ fontSize: 18, color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              },
            }}
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
                <SortableHeader label="Email" sortKey="email" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Роль" sortKey="role" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Статус" sortKey="status" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map(u => (
                <TableRow key={u.id} hover>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Chip label={ROLE_LABELS[u.role]} size="small" sx={
                      u.role === 'admin' ? { bgcolor: '#EDE9FE', color: '#5B21B6' } :
                      u.role === 'teacher' ? { bgcolor: '#DBEAFE', color: '#1D4ED8' } :
                                            { bgcolor: '#F5EDEA', color: '#5A3826' }
                    } />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={u.is_active ? 'Активен' : 'Отключён'}
                      size="small"
                      sx={u.is_active ? { bgcolor: '#D4EDDF', color: '#347856' } : { bgcolor: '#F4D0CC', color: '#D05050' }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => setModal({ mode: 'edit', user: u })}
                      sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                    >
                      <EditRounded fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setDeleteId(u.id)}
                      sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                    >
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
        <UserModal
          mode={modal.mode}
          user={modal.user}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load() }}
        />
      )}

      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Удалить пользователя?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">Это действие необратимо.</Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleteId(null)}>Отмена</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Удалить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function UserModal({ mode, user, onClose, onSave }: {
  mode: 'create' | 'edit'
  user?: UserMe
  onClose: () => void
  onSave: () => void
}) {
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserMe['role']>(user?.role ?? 'student')
  const [isActive, setIsActive] = useState(user?.is_active ?? true)
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [position, setPosition] = useState('')
  const [phone, setPhone] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [groupId, setGroupId] = useState('')
  const [studentNum, setStudentNum] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mode !== 'create') return
    Promise.all([getGroups(), getDepartments()]).then(([groupsData, departmentsData]) => {
      setGroups(groupsData)
      setDepartments(departmentsData)
      if (groupsData.length > 0) setGroupId(current => current || String(groupsData[0].id))
    })
  }, [mode])

  const submit = async () => {
    if (!email.trim()) { setError('Email обязателен'); return }
    if (mode === 'create' && !password) { setError('Пароль обязателен'); return }
    if (mode === 'create' && role !== 'admin') {
      if (!lastName.trim() || !firstName.trim()) { setError('Заполните фамилию и имя'); return }
      if (role === 'student' && !groupId) { setError('Выберите группу студента'); return }
    }

    setSaving(true)
    setError('')
    try {
      if (mode === 'create') {
        const optional = (value: string) => value.trim() || null
        const data: UserCreateData = { email: email.trim(), password, role }

        if (role === 'teacher') {
          data.teacher_profile = {
            last_name: lastName.trim(),
            first_name: firstName.trim(),
            middle_name: optional(middleName),
            position: optional(position),
            phone: optional(phone),
            department_id: departmentId ? Number(departmentId) : null,
          }
        }

        if (role === 'student') {
          data.student_profile = {
            last_name: lastName.trim(),
            first_name: firstName.trim(),
            middle_name: optional(middleName),
            birth_date: birthDate || null,
            group_id: Number(groupId),
            student_num: optional(studentNum),
            phone: optional(phone),
          }
        }

        await createUser(data)
      } else {
        await updateUser(user!.id, { email: email.trim(), role, is_active: isActive })
      }
      onSave()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Ошибка сохранения')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'create' ? 'Новый пользователь' : 'Редактировать пользователя'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Email" type="email" size="small" fullWidth value={email} onChange={e => setEmail(e.target.value)} />
          {mode === 'create' && (
            <TextField label="Пароль" type="password" size="small" fullWidth value={password} onChange={e => setPassword(e.target.value)} />
          )}
          <TextField select label="Роль" size="small" fullWidth value={role} onChange={e => setRole(e.target.value as UserMe['role'])}>
            <MenuItem value="admin">Администратор</MenuItem>
            <MenuItem value="teacher">Преподаватель</MenuItem>
            <MenuItem value="student">Студент</MenuItem>
          </TextField>

          {mode === 'create' && role !== 'admin' && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 0.5 }}>
                {role === 'teacher' ? 'Данные преподавателя' : 'Данные студента'}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField label="Фамилия" size="small" fullWidth value={lastName} onChange={e => setLastName(e.target.value)} />
                <TextField label="Имя" size="small" fullWidth value={firstName} onChange={e => setFirstName(e.target.value)} />
              </Stack>
              <TextField label="Отчество" size="small" fullWidth value={middleName} onChange={e => setMiddleName(e.target.value)} />
              {role === 'teacher' ? (
                <>
                  <TextField label="Должность" size="small" fullWidth value={position} onChange={e => setPosition(e.target.value)} />
                  <TextField select label="Кафедра" size="small" fullWidth value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
                    <MenuItem value="">Не выбрана</MenuItem>
                    {departments.map(department => (
                      <MenuItem key={department.id} value={String(department.id)}>{department.name}</MenuItem>
                    ))}
                  </TextField>
                </>
              ) : (
                <>
                  <TextField
                    label="Дата рождения"
                    type="date"
                    size="small"
                    fullWidth
                    value={birthDate}
                    onChange={e => setBirthDate(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField select label="Группа" size="small" fullWidth value={groupId} onChange={e => setGroupId(e.target.value)}>
                    {groups.map(group => (
                      <MenuItem key={group.id} value={String(group.id)}>{group.name}</MenuItem>
                    ))}
                  </TextField>
                  <TextField label="Номер студента" size="small" fullWidth value={studentNum} onChange={e => setStudentNum(e.target.value)} />
                </>
              )}
              <TextField label="Телефон" size="small" fullWidth value={phone} onChange={e => setPhone(e.target.value)} />
            </>
          )}

          {mode === 'edit' && (
            <TextField select label="Статус" size="small" fullWidth value={isActive ? 'true' : 'false'} onChange={e => setIsActive(e.target.value === 'true')}>
              <MenuItem value="true">Активен</MenuItem>
              <MenuItem value="false">Отключён</MenuItem>
            </TextField>
          )}
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
  <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
    <CircularProgress color="primary" />
  </Box>
)

const Empty = ({ text }: { text: string }) => (
  <Paper sx={{ p: 6, textAlign: 'center' }}>
    <Typography color="text.secondary">{text}</Typography>
  </Paper>
)
