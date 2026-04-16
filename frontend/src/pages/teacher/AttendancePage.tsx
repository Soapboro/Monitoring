import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, TextField, MenuItem, Button, Chip, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, Collapse, InputAdornment,
} from '@mui/material'
import { SearchRounded, ChevronRightRounded } from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import client from '../../api/client'
import type { TeachingAssignment } from '../../api/resources'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'
import { PEACH, WARM, CREAM } from '../../theme'

interface AttendanceOut {
  id: number; student_id: number; assignment_id: number
  lesson_date: string; is_present: boolean; comment: string | null
}
interface StudentProfile { id: number; last_name: string; first_name: string; middle_name: string | null }
interface SubjectInfo { id: number; name: string }
interface DateRow {
  date: string; total: number; present: number
  records: AttendanceOut[]; subjectNames: string[]
}

export default function AttendancePage() {
  const navigate = useNavigate()
  const [dateRows, setDateRows]     = useState<DateRow[]>([])
  const [studentMap, setStudentMap] = useState<Record<number, StudentProfile>>({})
  const [subjects, setSubjects]     = useState<SubjectInfo[]>([])
  const [assignmentSubjectMap, setAsgMap] = useState<Record<number, number>>({})
  const [expandedDate, setExpandedDate]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const [rateFilter, setRateFilter]       = useState<string>('all')

  useEffect(() => {
    async function init() {
      try {
        const teacher = await getMyTeacherProfile()
        const assignments: TeachingAssignment[] = await getAssignments(teacher.id)
        const subjectIds = [...new Set(assignments.map(a => a.subject_id))]
        const subjectMap: Record<number, string> = {}
        const subjectList: SubjectInfo[] = []
        await Promise.all(subjectIds.map(async sid => {
          try {
            const r = await client.get<SubjectInfo>(`/subjects/${sid}`)
            subjectMap[sid] = r.data.name; subjectList.push(r.data)
          } catch { /* silent */ }
        }))
        setSubjects(subjectList.sort((a, b) => a.name.localeCompare(b.name)))
        const aToSubject: Record<number, number> = {}
        for (const a of assignments) aToSubject[a.id] = a.subject_id
        setAsgMap(aToSubject)
        const all: AttendanceOut[] = []
        await Promise.all(assignments.map(async a => {
          try { const res = await client.get<AttendanceOut[]>('/attendance', { params: { assignment_id: a.id } }); all.push(...res.data) } catch { /* silent */ }
        }))
        const studentIds = [...new Set(all.map(r => r.student_id))]
        const sMap: Record<number, StudentProfile> = {}
        await Promise.all(studentIds.map(async sid => {
          try { const s = await client.get<StudentProfile>(`/students/${sid}`); sMap[sid] = s.data } catch { /* silent */ }
        }))
        setStudentMap(sMap)
        const byDate: Record<string, AttendanceOut[]> = {}
        for (const r of all) { const d = String(r.lesson_date).slice(0, 10); if (!byDate[d]) byDate[d] = []; byDate[d].push(r) }
        const rows: DateRow[] = Object.entries(byDate)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, records]) => {
            const uniqueSubjectIds = [...new Set(records.map(r => aToSubject[r.assignment_id]).filter(Boolean))]
            return { date, total: records.length, present: records.filter(r => r.is_present).length, records, subjectNames: uniqueSubjectIds.map(sid => subjectMap[sid]).filter(Boolean) as string[] }
          })
        setDateRows(rows)
      } catch { /* silent */ } finally { setLoading(false) }
    }
    init()
  }, [])

  const filtered = useMemo(() => dateRows.filter(row => {
    const rate = row.total > 0 ? Math.round(row.present / row.total * 100) : 0
    if (search && !row.date.includes(search)) return false
    if (subjectFilter !== 'all') {
      const sid = parseInt(subjectFilter)
      if (!row.records.some(r => assignmentSubjectMap[r.assignment_id] === sid)) return false
    }
    if (rateFilter === 'high' && rate < 75) return false
    if (rateFilter === 'medium' && (rate < 50 || rate >= 75)) return false
    if (rateFilter === 'low' && rate >= 50) return false
    return true
  }), [dateRows, search, subjectFilter, rateFilter, assignmentSubjectMap])

  const { sorted: sortedRows, sortKey, sortDir, toggleSort } = useSort(filtered, (row, key) => {
    if (key === 'date')    return row.date
    if (key === 'subjects') return row.subjectNames.join(', ')
    if (key === 'total')   return row.total
    if (key === 'present') return row.present
    if (key === 'rate')    return row.total > 0 ? Math.round(row.present / row.total * 100) : -1
    return ''
  })

  if (loading) return <Spin />

  const totalPresent = sortedRows.reduce((s, r) => s + r.present, 0)
  const totalAll     = sortedRows.reduce((s, r) => s + r.total, 0)
  const avgRate      = totalAll > 0 ? Math.round(totalPresent / totalAll * 100) : null

  return (
    <Box sx={{ p: 4, maxWidth: 900 }}>
      <Typography variant="h5" fontWeight={700}>Посещаемость</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Нажмите на дату для просмотра списка</Typography>

      {dateRows.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
          {[
            { label: 'Занятий', value: filtered.length, color: WARM[800] },
            { label: 'Всего отметок', value: totalAll, color: WARM[800] },
            { label: 'Средняя посещаемость', value: avgRate !== null ? `${avgRate}%` : '—', color: avgRate !== null && avgRate >= 75 ? '#347856' : '#C9874A' },
          ].map(c => (
            <Paper key={c.label} elevation={1} sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">{c.label}</Typography>
              <Typography variant="h5" fontWeight={700} sx={{ color: c.color }}>{c.value}</Typography>
            </Paper>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <TextField
          size="small" placeholder="Поиск по дате (гггг-мм-дд)..."
          value={search} onChange={e => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> } }}
          sx={{ flex: 1, minWidth: 200 }}
        />
        {subjects.length > 1 && (
          <TextField select size="small" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="all">Все предметы</MenuItem>
            {subjects.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>)}
          </TextField>
        )}
        <TextField select size="small" value={rateFilter} onChange={e => setRateFilter(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="all">Любая посещаемость</MenuItem>
          <MenuItem value="high">Высокая (≥75%)</MenuItem>
          <MenuItem value="medium">Средняя (50–74%)</MenuItem>
          <MenuItem value="low">Низкая (&lt;50%)</MenuItem>
        </TextField>
        {(search || subjectFilter !== 'all' || rateFilter !== 'all') && (
          <Button variant="outlined" size="small" onClick={() => { setSearch(''); setSubjectFilter('all'); setRateFilter('all') }}>
            Сбросить
          </Button>
        )}
      </Box>

      {sortedRows.length === 0 ? <Empty text="Ничего не найдено" /> : (
        <Paper elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <SortableHeader label="Дата"            sortKey="date"     currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Предмет(ы)"      sortKey="subjects" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Всего"           sortKey="total"    currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                <SortableHeader label="Присутствовало"  sortKey="present"  currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                <SortableHeader label="%"               sortKey="rate"     currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRows.map(row => {
                const rate   = Math.round(row.present / row.total * 100)
                const absent = row.records.filter(r => !r.is_present)
                const isOpen = expandedDate === row.date
                return (
                  <>
                    <TableRow
                      key={row.date}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setExpandedDate(isOpen ? null : row.date)}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <ChevronRightRounded sx={{ fontSize: 16, color: 'text.disabled', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                          <Typography variant="body2" fontWeight={500}>{row.date}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>
                        {row.subjectNames.length > 0 ? row.subjectNames.join(', ') : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>{row.total}</TableCell>
                      <TableCell align="right" sx={{ color: '#347856', fontWeight: 500 }}>{row.present}</TableCell>
                      <TableCell align="right">
                        <Chip label={`${rate}%`} size="small" sx={
                          rate >= 75 ? { bgcolor: '#D4EDDF', color: '#347856' } :
                          rate >= 50 ? { bgcolor: '#F5E2CE', color: '#C9874A' } :
                                       { bgcolor: '#F4D0CC', color: '#D05050' }
                        } />
                      </TableCell>
                    </TableRow>
                    <TableRow key={`${row.date}-detail`}>
                      <TableCell colSpan={5} sx={{ p: 0, border: 0 }}>
                        <Collapse in={isOpen}>
                          <Box sx={{ px: 4, py: 2, bgcolor: CREAM.bg }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}>
                              Присутствовали ({row.present})
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                              {row.records.filter(r => r.is_present).map(r => {
                                const s = studentMap[r.student_id]
                                return (
                                  <Chip
                                    key={r.id}
                                    label={s ? `${s.last_name} ${s.first_name}` : `#${r.student_id}`}
                                    size="small"
                                    onClick={e => { e.stopPropagation(); navigate(`/students/${r.student_id}`) }}
                                    sx={{ bgcolor: '#D4EDDF', color: '#347856', cursor: 'pointer', '&:hover': { bgcolor: '#C0E5D0' } }}
                                  />
                                )
                              })}
                            </Box>
                            {absent.length > 0 && (
                              <>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}>
                                  Отсутствовали ({absent.length})
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                  {absent.map(r => {
                                    const s = studentMap[r.student_id]
                                    return (
                                      <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <Chip
                                          label={s ? `${s.last_name} ${s.first_name}` : `#${r.student_id}`}
                                          size="small"
                                          onClick={e => { e.stopPropagation(); navigate(`/students/${r.student_id}`) }}
                                          sx={{ bgcolor: '#F4D0CC', color: '#D05050', cursor: 'pointer', '&:hover': { bgcolor: '#ECC0BC' } }}
                                        />
                                        {r.comment && (
                                          <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                                            Причина: {r.comment}
                                          </Typography>
                                        )}
                                      </Box>
                                    )
                                  })}
                                </Box>
                              </>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </>
                )
              })}
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
