import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, TextField, Chip, Avatar,
  Table, TableHead, TableBody, TableRow, TableCell,
  InputAdornment, CircularProgress, Link as MuiLink,
} from '@mui/material'
import { SearchRounded } from '@mui/icons-material'
import { getStudents, getGroups } from '../../api/resources'
import type { StudentProfile } from '../../api/resources'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'
import { PEACH, WARM } from '../../theme'

export default function StudentsPage() {
  const navigate = useNavigate()
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [groupNames, setGroupNames] = useState<Record<number, string>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getStudents(), getGroups()]).then(([studs, groups]) => {
      setStudents(studs)
      const map: Record<number, string> = {}
      for (const g of groups) map[g.id] = g.name
      setGroupNames(map)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = students.filter(s => {
    const full = `${s.last_name} ${s.first_name} ${s.middle_name ?? ''} ${s.student_num ?? ''}`.toLowerCase()
    return full.includes(search.toLowerCase())
  })

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, (s, key) => {
    if (key === 'name')        return `${s.last_name} ${s.first_name}`
    if (key === 'student_num') return s.student_num ?? ''
    if (key === 'group')       return groupNames[s.group_id] ?? ''
    if (key === 'status')      return s.is_active
    return ''
  })

  if (loading) return <Spin />

  return (
    <Box sx={{ p: 4, maxWidth: 1000 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Студенты</Typography>
          <Typography variant="body2" color="text.secondary">Всего: {students.length}</Typography>
        </Box>
        <TextField
          size="small" placeholder="Поиск по ФИО или номеру..."
          value={search} onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> }}
          sx={{ width: 280 }}
        />
      </Box>

      {sorted.length === 0 ? <Empty text="Ничего не найдено" /> : (
        <Paper elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <SortableHeader label="ФИО"     sortKey="name"        currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="№ студ." sortKey="student_num" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Группа"  sortKey="group"       currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Статус"  sortKey="status"      currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map(s => (
                <TableRow key={s.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/students/${s.id}`)}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: 12, fontWeight: 700, bgcolor: PEACH[100], color: PEACH[700] }}>
                        {s.last_name[0]}
                      </Avatar>
                      <Typography variant="body2" fontWeight={500} color={WARM[800]}>
                        {s.last_name} {s.first_name} {s.middle_name ?? ''}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{s.student_num ?? '—'}</TableCell>
                  <TableCell>
                    <MuiLink
                      component="button"
                      underline="hover"
                      color="primary"
                      variant="body2"
                      onClick={e => { e.stopPropagation(); navigate(`/groups/${s.group_id}`) }}
                    >
                      {groupNames[s.group_id] ?? `#${s.group_id}`}
                    </MuiLink>
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={s.is_active ? 'Активен' : 'Неактивен'} size="small"
                      sx={s.is_active ? { bgcolor: '#D4EDDF', color: '#347856' } : { bgcolor: '#F5EDEA', color: WARM[500] }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  )
}

const Spin = () => (
  <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress color="primary" /></Box>
)
const Empty = ({ text }: { text: string }) => (
  <Paper sx={{ p: 6, textAlign: 'center' }}><Typography color="text.secondary">{text}</Typography></Paper>
)
