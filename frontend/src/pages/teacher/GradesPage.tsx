import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, Chip, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell,
  TextField, Select, MenuItem, Button, InputAdornment,
  Collapse, Link,
} from '@mui/material'
import { SearchRounded, ChevronRightRounded } from '@mui/icons-material'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import client from '../../api/client'
import type { GradeOut, StudentProfile, TeachingAssignment, Subject } from '../../api/resources'
import { useSort } from '../../hooks/useSort'
import SortableHeader from '../../components/SortableHeader'

interface EnrichedGrade extends GradeOut {
  studentName: string
  subjectName: string
  subjectId: number
  assignment: TeachingAssignment
}

interface EditState {
  grade_type: string
  value: string
  passed: string
  comment: string
  date_recorded: string
}

const GRADE_TYPES = [
  { value: 'current', label: 'Текущая' },
  { value: 'thematic', label: 'Тематическая' },
  { value: 'midterm', label: 'Промежуточная' },
  { value: 'final', label: 'Итоговая' },
  { value: 'attendance', label: 'Посещаемость' },
  { value: 'test', label: 'Тестирование' },
]

function gradeTypeLabel(type: string) { return GRADE_TYPES.find(t => t.value === type)?.label ?? type }

function toEditState(g: EnrichedGrade): EditState {
  return {
    grade_type: g.grade_type,
    value: g.value !== null ? String(g.value) : '',
    passed: g.passed === true ? 'true' : g.passed === false ? 'false' : 'null',
    comment: g.comment ?? '',
    date_recorded: g.date_recorded.slice(0, 10),
  }
}

const gradeChip = (v: number) =>
  v >= 4 ? { bgcolor: '#D4EDDF', color: '#347856' } :
  v >= 3 ? { bgcolor: '#DBEAFE', color: '#1D4ED8' } :
           { bgcolor: '#F4D0CC', color: '#D05050' }

export default function GradesPage() {
  const navigate = useNavigate()
  const [grades, setGrades] = useState<EnrichedGrade[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [gradeTypes, setGradeTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [valueFilter, setValueFilter] = useState<string>('all')

  useEffect(() => {
    async function init() {
      try {
        const teacher = await getMyTeacherProfile()
        const assignments: TeachingAssignment[] = await getAssignments(teacher.id)

        const subjectIds = [...new Set(assignments.map(a => a.subject_id))]
        const subjectMap: Record<number, string> = {}
        const subjectList: Subject[] = []
        await Promise.all(subjectIds.map(sid =>
          client.get<Subject>(`/subjects/${sid}`).then(r => { subjectMap[sid] = r.data.name; subjectList.push(r.data) })
        ))
        setSubjects(subjectList.sort((a, b) => a.name.localeCompare(b.name)))

        const assignmentMap: Record<number, TeachingAssignment> = {}
        for (const a of assignments) assignmentMap[a.id] = a

        const rawGrades: GradeOut[] = []
        await Promise.all(assignments.map(a =>
          client.get<GradeOut[]>('/grades', { params: { assignment_id: a.id } }).then(r => { rawGrades.push(...r.data) })
        ))

        const studentIds = [...new Set(rawGrades.map(g => g.student_id))]
        const studentMap: Record<number, string> = {}
        await Promise.all(studentIds.map(sid =>
          client.get<StudentProfile>(`/students/${sid}`).then(r => {
            const s = r.data
            studentMap[sid] = `${s.last_name} ${s.first_name}${s.middle_name ? ' ' + s.middle_name : ''}`
          }).catch(() => { studentMap[sid] = `Студент #${sid}` })
        ))

        const enriched: EnrichedGrade[] = rawGrades.map(g => {
          const a = assignmentMap[g.assignment_id]
          return { ...g, studentName: studentMap[g.student_id] ?? `Студент #${g.student_id}`, subjectName: subjectMap[a?.subject_id] ?? `Предмет #${g.assignment_id}`, subjectId: a?.subject_id ?? 0, assignment: a }
        })
        enriched.sort((a, b) => b.date_recorded.localeCompare(a.date_recorded))
        setGrades(enriched)
        setGradeTypes([...new Set(enriched.map(g => g.grade_type))])
      } catch { /* silent */ } finally { setLoading(false) }
    }
    init()
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return grades.filter(g => {
      if (q && !g.studentName.toLowerCase().includes(q) && !g.subjectName.toLowerCase().includes(q)) return false
      if (subjectFilter !== 'all' && String(g.subjectId) !== subjectFilter) return false
      if (typeFilter !== 'all' && g.grade_type !== typeFilter) return false
      if (valueFilter !== 'all') {
        if (valueFilter === 'pass' && g.passed !== true) return false
        if (valueFilter === 'fail' && g.passed !== false) return false
        if (!isNaN(Number(valueFilter)) && g.value !== Number(valueFilter)) return false
      }
      return true
    })
  }, [grades, search, subjectFilter, typeFilter, valueFilter])

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, (g, key) => {
    if (key === 'date') return g.date_recorded
    if (key === 'student') return g.studentName
    if (key === 'subject') return g.subjectName
    if (key === 'type') return gradeTypeLabel(g.grade_type)
    if (key === 'value') return g.value ?? (g.passed === true ? 1 : g.passed === false ? 0 : -1)
    return ''
  })

  const toggle = (id: number) => {
    if (expanded === id) { setExpanded(null); setEditing(null); setEditState(null) }
    else { setExpanded(id); setEditing(null); setEditState(null) }
  }

  const startEdit = (g: EnrichedGrade, e: React.MouseEvent) => {
    e.stopPropagation(); setEditing(g.id); setEditState(toEditState(g))
  }
  const cancelEdit = (e: React.MouseEvent) => { e.stopPropagation(); setEditing(null); setEditState(null) }

  const saveEdit = async (g: EnrichedGrade, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!editState) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { grade_type: editState.grade_type, comment: editState.comment || null, date_recorded: editState.date_recorded }
      if (editState.value !== '') payload.value = Number(editState.value)
      if (editState.passed !== 'null') payload.passed = editState.passed === 'true'
      const { data } = await client.patch<GradeOut>(`/grades/${g.id}`, payload)
      setGrades(prev => prev.map(gr => gr.id === g.id ? { ...gr, ...data } : gr))
      setEditing(null); setEditState(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(msg ?? 'Ошибка сохранения')
    } finally { setSaving(false) }
  }

  const hasFilters = search || subjectFilter !== 'all' || typeFilter !== 'all' || valueFilter !== 'all'

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>

  return (
    <Box sx={{ p: 4, maxWidth: 900 }}>
      <Typography variant="h5" fontWeight={700}>Оценки</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Все выставленные оценки по вашим дисциплинам</Typography>

      {/* Filters */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Поиск по студенту или предмету..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> }}
          sx={{ minWidth: 260, flex: 1 }}
        />
        {subjects.length > 1 && (
          <Select size="small" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="all">Все предметы</MenuItem>
            {subjects.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>)}
          </Select>
        )}
        <Select size="small" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="all">Все типы</MenuItem>
          {gradeTypes.map(t => <MenuItem key={t} value={t}>{gradeTypeLabel(t)}</MenuItem>)}
        </Select>
        <Select size="small" value={valueFilter} onChange={e => setValueFilter(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="all">Любая оценка</MenuItem>
          <MenuItem value="5">5</MenuItem>
          <MenuItem value="4">4</MenuItem>
          <MenuItem value="3">3</MenuItem>
          <MenuItem value="2">2</MenuItem>
          <MenuItem value="pass">Зачёт</MenuItem>
          <MenuItem value="fail">Незачёт</MenuItem>
        </Select>
        {hasFilters && (
          <Button variant="outlined" size="small" color="inherit" onClick={() => { setSearch(''); setSubjectFilter('all'); setTypeFilter('all'); setValueFilter('all') }}>
            Сбросить
          </Button>
        )}
      </Box>

      {grades.length > 0 && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5 }}>
          Показано: {filtered.length} из {grades.length}
        </Typography>
      )}

      {filtered.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">{grades.length === 0 ? 'Оценок пока нет' : 'Ничего не найдено'}</Typography>
        </Paper>
      ) : (
        <Paper elevation={2} sx={{ overflow: 'hidden' }}>
          <Table>
            <TableHead>
              <TableRow>
                <SortableHeader label="Дата" sortKey="date" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Студент" sortKey="student" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Предмет" sortKey="subject" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Тип" sortKey="type" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Оценка" sortKey="value" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                <TableCell sx={{ width: 40 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map(g => (
                <>
                  <TableRow key={g.id} hover sx={{ cursor: 'pointer' }} onClick={() => toggle(g.id)}>
                    <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{g.date_recorded.slice(0, 10)}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{g.studentName}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{g.subjectName}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{gradeTypeLabel(g.grade_type)}</TableCell>
                    <TableCell align="right">
                      {g.value !== null
                        ? <Chip label={g.value} size="small" sx={gradeChip(g.value)} />
                        : g.passed !== null
                        ? <Chip label={g.passed ? 'Зачёт' : 'Незачёт'} size="small" sx={g.passed ? { bgcolor: '#D4EDDF', color: '#347856' } : { bgcolor: '#F4D0CC', color: '#D05050' }} />
                        : <Typography variant="body2" color="text.disabled">—</Typography>}
                    </TableCell>
                    <TableCell align="right" sx={{ pr: 2 }}>
                      <ChevronRightRounded sx={{ fontSize: 16, color: 'text.disabled', transform: expanded === g.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                    </TableCell>
                  </TableRow>
                  <TableRow key={`${g.id}-detail`}>
                    <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
                      <Collapse in={expanded === g.id} unmountOnExit>
                        <Box sx={{ px: 4, py: 3, bgcolor: '#F8FAFC' }} onClick={e => e.stopPropagation()}>
                          {editing === g.id && editState ? (
                            /* Edit mode */
                            <Box>
                              <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, display: 'block', mb: 2 }}>
                                Редактирование оценки
                              </Typography>
                              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                <TextField
                                  select label="Тип оценки" size="small" fullWidth
                                  value={editState.grade_type}
                                  onChange={e => setEditState(s => s && ({ ...s, grade_type: e.target.value }))}
                                >
                                  {GRADE_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                                </TextField>
                                <TextField
                                  label="Дата" type="date" size="small" fullWidth
                                  value={editState.date_recorded}
                                  onChange={e => setEditState(s => s && ({ ...s, date_recorded: e.target.value }))}
                                  InputLabelProps={{ shrink: true }}
                                />
                                <TextField
                                  label="Балл (1–5)" type="number" size="small"
                                  inputProps={{ min: 1, max: 5, step: 1 }}
                                  value={editState.value}
                                  onChange={e => setEditState(s => s && ({ ...s, value: e.target.value }))}
                                  placeholder="—"
                                  sx={{ width: 120 }}
                                />
                                <TextField
                                  select label="Зачёт / незачёт" size="small" fullWidth
                                  value={editState.passed}
                                  onChange={e => setEditState(s => s && ({ ...s, passed: e.target.value }))}
                                >
                                  <MenuItem value="null">Не задан</MenuItem>
                                  <MenuItem value="true">Зачёт</MenuItem>
                                  <MenuItem value="false">Незачёт</MenuItem>
                                </TextField>
                                <TextField
                                  label="Комментарий" size="small" fullWidth
                                  sx={{ gridColumn: 'span 2' }}
                                  value={editState.comment}
                                  onChange={e => setEditState(s => s && ({ ...s, comment: e.target.value }))}
                                  placeholder="Необязательно"
                                />
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
                                <Button variant="contained" size="small" disabled={saving} onClick={e => saveEdit(g, e)}>
                                  {saving ? 'Сохранение...' : 'Сохранить'}
                                </Button>
                                <Button variant="outlined" size="small" color="inherit" onClick={cancelEdit}>Отмена</Button>
                              </Box>
                            </Box>
                          ) : (
                            /* View mode */
                            <Box>
                              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
                                <Box>
                                  <Typography variant="caption" color="text.secondary">Студент</Typography>
                                  <Box>
                                    <Link
                                      underline="hover"
                                      sx={{ cursor: 'pointer', fontWeight: 500, fontSize: 14 }}
                                      onClick={e => { e.stopPropagation(); navigate(`/students/${g.student_id}`) }}
                                    >
                                      {g.studentName}
                                    </Link>
                                  </Box>
                                </Box>
                                <Box>
                                  <Typography variant="caption" color="text.secondary">Предмет</Typography>
                                  <Typography variant="body2" fontWeight={500}>{g.subjectName}</Typography>
                                </Box>
                                <Box>
                                  <Typography variant="caption" color="text.secondary">Тип оценки</Typography>
                                  <Typography variant="body2" fontWeight={500}>{gradeTypeLabel(g.grade_type)}</Typography>
                                </Box>
                                <Box>
                                  <Typography variant="caption" color="text.secondary">Оценка / результат</Typography>
                                  <Typography variant="body2" fontWeight={500}>
                                    {g.value !== null ? String(g.value) : g.passed !== null ? (g.passed ? 'Зачёт' : 'Незачёт') : '—'}
                                  </Typography>
                                </Box>
                                {g.assignment && (
                                  <>
                                    <Box>
                                      <Typography variant="caption" color="text.secondary">Учебный год</Typography>
                                      <Typography variant="body2" fontWeight={500}>{g.assignment.acad_year}</Typography>
                                    </Box>
                                    <Box>
                                      <Typography variant="caption" color="text.secondary">Семестр</Typography>
                                      <Typography variant="body2" fontWeight={500}>{g.assignment.semester}</Typography>
                                    </Box>
                                  </>
                                )}
                                {g.comment && (
                                  <Box sx={{ gridColumn: 'span 2' }}>
                                    <Typography variant="caption" color="text.secondary">Комментарий</Typography>
                                    <Typography variant="body2">{g.comment}</Typography>
                                  </Box>
                                )}
                              </Box>
                              <Button variant="outlined" size="small" onClick={e => startEdit(g, e)}>Изменить</Button>
                            </Box>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  )
}
