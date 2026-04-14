import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, TextField, Avatar,
  Table, TableHead, TableBody, TableRow, TableCell,
  InputAdornment, CircularProgress,
} from '@mui/material'
import { SearchRounded } from '@mui/icons-material'
import { getTeachers } from '../../api/resources'
import type { TeacherProfile } from '../../api/resources'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'
import { PEACH, WARM } from '../../theme'

export default function TeachersPage() {
  const navigate = useNavigate()
  const [teachers, setTeachers] = useState<TeacherProfile[]>([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    getTeachers().then(setTeachers).finally(() => setLoading(false))
  }, [])

  const filtered = teachers.filter(t =>
    `${t.last_name} ${t.first_name} ${t.middle_name ?? ''} ${t.position ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, (t, key) => {
    if (key === 'name')     return `${t.last_name} ${t.first_name}`
    if (key === 'position') return t.position ?? ''
    if (key === 'phone')    return t.phone ?? ''
    return ''
  })

  if (loading) return <Spin />

  return (
    <Box sx={{ p: 4, maxWidth: 1000 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Преподаватели</Typography>
          <Typography variant="body2" color="text.secondary">Всего: {teachers.length}</Typography>
        </Box>
        <TextField
          size="small" placeholder="Поиск по ФИО или должности..."
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
                <SortableHeader label="ФИО"       sortKey="name"     currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Должность" sortKey="position" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Телефон"   sortKey="phone"    currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map(t => (
                <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/teachers/${t.id}`)}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: 12, fontWeight: 700, bgcolor: PEACH[100], color: PEACH[700] }}>
                        {t.last_name[0]}
                      </Avatar>
                      <Typography variant="body2" fontWeight={500} color={WARM[800]}>
                        {t.last_name} {t.first_name} {t.middle_name ?? ''}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{t.position ?? '—'}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{t.phone ?? '—'}</TableCell>
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
