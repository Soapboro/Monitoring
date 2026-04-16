import { useEffect, useState } from 'react'
import {
  Box, Paper, Typography, TextField, Chip, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, InputAdornment,
} from '@mui/material'
import { SearchRounded } from '@mui/icons-material'
import { getMyAttendance } from '../../api/resources'
import type { AttendanceRecord } from '../../api/resources'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'
import { WARM } from '../../theme'

export default function MyAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyAttendance().then(setRecords).finally(() => setLoading(false))
  }, [])

  const filtered = records.filter(r =>
    String(r.lesson_date).slice(0, 10).includes(search) ||
    (r.is_present ? 'присутствовал' : 'отсутствовал').includes(search.toLowerCase())
  )
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, (r, key) => {
    if (key === 'date')   return String(r.lesson_date).slice(0, 10)
    if (key === 'status') return r.is_present ? 1 : 0
    return ''
  })

  if (loading) return <Spin />

  const present = records.filter(r => r.is_present).length
  const rate    = records.length > 0 ? Math.round(present / records.length * 100) : null

  return (
    <Box sx={{ p: 4, maxWidth: 700 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h5" fontWeight={700}>Посещаемость</Typography>
        <TextField
          size="small" placeholder="Поиск по дате или статусу..."
          value={search} onChange={e => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> } }}
          sx={{ width: 240 }}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        История посещений занятий · Всего: {records.length}
      </Typography>

      {records.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
          {[
            { label: 'Всего занятий', value: records.length, color: WARM[800] },
            { label: 'Присутствовал', value: present, color: '#347856' },
            { label: 'Посещаемость', value: rate !== null ? `${rate}%` : '—', color: rate !== null && rate >= 75 ? '#347856' : '#C9874A' },
          ].map(c => (
            <Paper key={c.label} elevation={1} sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">{c.label}</Typography>
              <Typography variant="h5" fontWeight={700} sx={{ color: c.color }}>{c.value}</Typography>
            </Paper>
          ))}
        </Box>
      )}

      {sorted.length === 0 ? (
        <Empty text={records.length === 0 ? 'Записей о посещаемости нет' : 'Ничего не найдено'} />
      ) : (
        <Paper elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <SortableHeader label="Дата"   sortKey="date"   currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Статус" sortKey="status" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map(r => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ color: 'text.secondary' }}>{String(r.lesson_date).slice(0, 10)}</TableCell>
                  <TableCell align="right">
                    <Chip
                      label={r.is_present ? 'Присутствовал' : 'Отсутствовал'}
                      size="small"
                      sx={r.is_present ? { bgcolor: '#D4EDDF', color: '#347856' } : { bgcolor: '#F4D0CC', color: '#D05050' }}
                    />
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

const Spin  = () => <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress color="primary" /></Box>
const Empty = ({ text }: { text: string }) => (
  <Paper sx={{ p: 6, textAlign: 'center' }}><Typography color="text.secondary">{text}</Typography></Paper>
)
