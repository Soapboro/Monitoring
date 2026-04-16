import { useEffect, useState } from 'react'
import {
  Box, Paper, Typography, TextField, Chip, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, InputAdornment,
} from '@mui/material'
import { SearchRounded } from '@mui/icons-material'
import { getMyGrades } from '../../api/resources'
import type { GradeOut } from '../../api/resources'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'

const GRADE_TYPE_LABELS: Record<string, string> = {
  current: 'Текущая', midterm: 'Промежуточная', final: 'Итоговая', test: 'Тест',
}

export default function MyGradesPage() {
  const [grades, setGrades] = useState<GradeOut[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyGrades().then(setGrades).finally(() => setLoading(false))
  }, [])

  const filtered = grades.filter(g =>
    `${g.date_recorded} ${GRADE_TYPE_LABELS[g.grade_type] ?? g.grade_type}`.toLowerCase().includes(search.toLowerCase())
  )
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, (g, key) => {
    if (key === 'date')   return g.date_recorded
    if (key === 'type')   return GRADE_TYPE_LABELS[g.grade_type] ?? g.grade_type
    if (key === 'value')  return g.value ?? -1
    if (key === 'passed') return g.passed === true ? 1 : g.passed === false ? 0 : -1
    return ''
  })

  if (loading) return <Spin />

  return (
    <Box sx={{ p: 4, maxWidth: 700 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Мои оценки</Typography>
          <Typography variant="body2" color="text.secondary">Всего: {grades.length}</Typography>
        </Box>
        <TextField
          size="small" placeholder="Поиск по дате или типу..."
          value={search} onChange={e => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> } }}
          sx={{ width: 240 }}
        />
      </Box>

      {sorted.length === 0 ? <Empty text="Ничего не найдено" /> : (
        <Paper elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <SortableHeader label="Дата"   sortKey="date"   currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Тип"    sortKey="type"   currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Оценка" sortKey="value"  currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                <SortableHeader label="Зачёт"  sortKey="passed" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map(g => (
                <TableRow key={g.id} hover>
                  <TableCell sx={{ color: 'text.secondary' }}>{String(g.date_recorded).slice(0, 10)}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{GRADE_TYPE_LABELS[g.grade_type] ?? g.grade_type}</TableCell>
                  <TableCell align="right">
                    {g.value !== null ? (
                      <Chip label={g.value} size="small" sx={
                        g.value >= 4 ? { bgcolor: '#D4EDDF', color: '#347856' } :
                        g.value >= 3 ? { bgcolor: '#DBEAFE', color: '#1D4ED8' } :
                                       { bgcolor: '#F4D0CC', color: '#D05050' }
                      } />
                    ) : <Typography variant="body2" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell align="right">
                    {g.passed === true  && <Typography variant="caption" sx={{ color: '#347856', fontWeight: 600 }}>Сдано</Typography>}
                    {g.passed === false && <Typography variant="caption" sx={{ color: '#D05050', fontWeight: 600 }}>Не сдано</Typography>}
                    {g.passed === null  && <Typography variant="body2" color="text.disabled">—</Typography>}
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
