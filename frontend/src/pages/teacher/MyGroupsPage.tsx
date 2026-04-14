import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, Chip, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell,
  Collapse, IconButton,
} from '@mui/material'
import { ChevronRightRounded, ExpandMoreRounded } from '@mui/icons-material'
import client from '../../api/client'
import { getMyTeacherProfile, getAssignments } from '../../api/resources'
import type { TeachingAssignment, Subject, Group, StudentProfile } from '../../api/resources'
import { getTopStudents } from '../../api/analytics'
import type { TopStudent } from '../../api/analytics'
import { WARM } from '../../theme'

interface GroupRow {
  group: Group
  assignments: { assignment: TeachingAssignment; subject: Subject }[]
  students: StudentProfile[]
  topStudents: TopStudent[]
}

const gradeChip = (avg: number) =>
  avg >= 4.5 ? { bgcolor: '#D4EDDF', color: '#347856' } :
  avg >= 3.5 ? { bgcolor: '#DBEAFE', color: '#1D4ED8' } :
  avg >= 2.5 ? { bgcolor: '#FEF3C7', color: '#92400E' } :
               { bgcolor: '#F4D0CC', color: '#D05050' }

export default function MyGroupsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<GroupRow[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const teacher = await getMyTeacherProfile()
      const assignments: TeachingAssignment[] = await getAssignments(teacher.id)

      const groupIds = [...new Set(assignments.map(a => a.group_id))]
      const subjectIds = [...new Set(assignments.map(a => a.subject_id))]

      const [groups, subjects] = await Promise.all([
        Promise.all(groupIds.map(gid => client.get<Group>(`/groups/${gid}`).then(r => r.data).catch(() => null))),
        Promise.all(subjectIds.map(sid => client.get<Subject>(`/subjects/${sid}`).then(r => r.data).catch(() => null))),
      ])

      const groupMap: Record<number, Group> = {}
      for (const g of groups) if (g) groupMap[g.id] = g
      const subjectMap: Record<number, Subject> = {}
      for (const s of subjects) if (s) subjectMap[s.id] = s

      const result: GroupRow[] = await Promise.all(
        groupIds.map(async gid => {
          const grp = groupMap[gid]
          if (!grp) return null
          const grpAssignments = assignments.filter(a => a.group_id === gid).map(a => ({
            assignment: a,
            subject: subjectMap[a.subject_id] ?? { id: a.subject_id, name: `Предмет #${a.subject_id}`, code: null, hours_total: null, department_id: null },
          }))
          const [studs, top] = await Promise.all([
            client.get<StudentProfile[]>('/students', { params: { group_id: gid } }).then(r => r.data).catch(() => []),
            getTopStudents(gid, 5000).catch(() => []),
          ])
          return { group: grp, assignments: grpAssignments, students: studs, topStudents: top }
        })
      ).then(list => list.filter(Boolean) as GroupRow[])

      result.sort((a, b) => a.group.name.localeCompare(b.group.name))
      setRows(result)
      if (result.length > 0) setExpanded(result[0].group.id)
    }
    init().finally(() => setLoading(false))
  }, [])

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>

  return (
    <Box sx={{ p: 4, maxWidth: 900 }}>
      <Typography variant="h5" fontWeight={700}>Мои группы</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Группы, которым вы преподаёте · {rows.length} групп
      </Typography>

      {rows.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">Нет назначенных групп. Обратитесь к администратору.</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rows.map(({ group, assignments, students, topStudents }) => {
            const isOpen = expanded === group.id
            const sorted = [...topStudents].sort((a, b) => Number(b.avg_grade) - Number(a.avg_grade))

            return (
              <Paper key={group.id} elevation={1} sx={{ overflow: 'hidden' }}>
                {/* Group header */}
                <Box
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  onClick={() => setExpanded(isOpen ? null : group.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <ChevronRightRounded sx={{ fontSize: 18, color: 'text.disabled', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                    <Typography fontWeight={600}>{group.name}</Typography>
                    <Typography variant="caption" color="text.disabled">набор {group.year_start}</Typography>
                    <Chip
                      label={group.is_active ? 'Активна' : 'Неактивна'}
                      size="small"
                      sx={group.is_active ? { bgcolor: '#D4EDDF', color: '#347856' } : { bgcolor: '#F1F5F9', color: '#64748b' }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Typography variant="caption" color="text.disabled">{students.length} студ.</Typography>
                    <Typography variant="caption" color="text.disabled">{assignments.length} предм.</Typography>
                  </Box>
                </Box>

                <Collapse in={isOpen} unmountOnExit>
                  <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
                    {/* Subjects row */}
                    <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', bgcolor: '#EFF6FF' }}>
                      <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, display: 'block', mb: 1 }}>
                        Ваши предметы
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {assignments.map(({ assignment, subject }) => (
                          <Chip
                            key={assignment.id}
                            label={`${subject.name} · ${assignment.acad_year} / ${assignment.semester} сем.`}
                            size="small"
                            onClick={() => navigate(`/assignments/${assignment.id}`)}
                            sx={{ bgcolor: 'white', border: '1px solid #BFDBFE', color: '#1D4ED8', cursor: 'pointer', '&:hover': { bgcolor: '#EFF6FF' } }}
                          />
                        ))}
                      </Box>
                    </Box>

                    {/* Students table */}
                    {students.length === 0 ? (
                      <Typography sx={{ px: 3, py: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>Студентов нет</Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ width: 40, color: 'text.disabled', fontWeight: 500 }}>#</TableCell>
                            <TableCell sx={{ color: 'text.secondary', fontWeight: 500 }}>Студент</TableCell>
                            <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 500 }}>Средний балл</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {students
                            .map(s => {
                              const top = sorted.find(t => t.id === s.id)
                              return { s, avg: top ? Number(top.avg_grade) : null }
                            })
                            .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1))
                            .map(({ s, avg }, i) => (
                              <TableRow
                                key={s.id}
                                hover
                                sx={{ cursor: 'pointer' }}
                                onClick={() => navigate(`/students/${s.id}`)}
                              >
                                <TableCell sx={{ color: 'text.disabled' }}>{i + 1}</TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      <Typography variant="caption" fontWeight={700} sx={{ color: '#1D4ED8' }}>{s.last_name[0]}</Typography>
                                    </Box>
                                    <Typography variant="body2" fontWeight={500}>
                                      {s.last_name} {s.first_name} {s.middle_name ?? ''}
                                    </Typography>
                                    {!s.is_active && (
                                      <Chip label="неактивен" size="small" sx={{ bgcolor: '#F1F5F9', color: '#64748b', height: 18, fontSize: 10 }} />
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell align="right">
                                  {avg !== null
                                    ? <Chip label={avg.toFixed(2)} size="small" sx={gradeChip(avg)} />
                                    : <Typography variant="caption" color="text.disabled">нет оценок</Typography>}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    )}
                  </Box>
                </Collapse>
              </Paper>
            )
          })}
        </Box>
      )}
    </Box>
  )
}
