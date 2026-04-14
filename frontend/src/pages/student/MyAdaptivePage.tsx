import { useEffect, useState } from 'react'
import {
  Box, Paper, Typography, TextField, Chip, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell,
  InputAdornment, LinearProgress,
} from '@mui/material'
import { SearchRounded } from '@mui/icons-material'
import client from '../../api/client'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'

interface AdaptiveRow {
  topic_id: number; topic: string; subject: string
  mastery_level: number; recommended_difficulty: number; updated_at: string
}

export default function MyAdaptivePage() {
  const [rows, setRows]     = useState<AdaptiveRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get<AdaptiveRow[]>('/students/me/adaptive').then(r => setRows(r.data)).finally(() => setLoading(false))
  }, [])

  const filtered = rows.filter(r => `${r.topic} ${r.subject}`.toLowerCase().includes(search.toLowerCase()))
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, (r, key) => {
    if (key === 'topic')      return r.topic
    if (key === 'subject')    return r.subject
    if (key === 'mastery')    return r.mastery_level
    if (key === 'difficulty') return r.recommended_difficulty
    return ''
  })

  if (loading) return <Spin />

  return (
    <Box sx={{ p: 4, maxWidth: 860 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h5" fontWeight={700}>Рекомендации</Typography>
        <TextField
          size="small" placeholder="Поиск по теме или предмету..."
          value={search} onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> }}
          sx={{ width: 260 }}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Адаптивные рекомендации по темам на основе ваших результатов
      </Typography>

      {sorted.length === 0 ? (
        <Empty text={rows.length === 0 ? 'Рекомендаций пока нет — пройдите несколько тестов' : 'Ничего не найдено'} />
      ) : (
        <Paper elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <SortableHeader label="Тема"          sortKey="topic"      currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Предмет"       sortKey="subject"    currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Освоение"      sortKey="mastery"    currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                <SortableHeader label="Рек. сложность" sortKey="difficulty" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map(r => {
                const pct = Math.round(r.mastery_level * 100)
                const diffLabel = r.recommended_difficulty <= 2 ? 'Лёгкая' : r.recommended_difficulty <= 3 ? 'Средняя' : 'Сложная'
                const diffSx = r.recommended_difficulty <= 2
                  ? { bgcolor: '#D4EDDF', color: '#347856' }
                  : r.recommended_difficulty <= 3
                  ? { bgcolor: '#DBEAFE', color: '#1D4ED8' }
                  : { bgcolor: '#F5E2CE', color: '#C9874A' }
                return (
                  <TableRow key={r.topic_id} hover>
                    <TableCell><Typography variant="body2" fontWeight={500}>{r.topic}</Typography></TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{r.subject}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'flex-end' }}>
                        <LinearProgress
                          variant="determinate" value={pct}
                          sx={{ width: 80, height: 6, borderRadius: 3,
                            bgcolor: '#F5EDEA',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: pct >= 75 ? '#4A9B72' : pct >= 50 ? 'primary.main' : '#C9874A',
                              borderRadius: 3,
                            }
                          }}
                        />
                        <Typography variant="caption" sx={{ minWidth: 30, textAlign: 'right', color: 'text.secondary' }}>{pct}%</Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Chip label={diffLabel} size="small" sx={diffSx} />
                    </TableCell>
                  </TableRow>
                )
              })}
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
