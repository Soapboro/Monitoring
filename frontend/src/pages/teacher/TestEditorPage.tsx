import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Paper, Typography, Chip, CircularProgress, Button, IconButton,
  Tabs, Tab, TextField, Checkbox, FormControlLabel, Select, MenuItem,
  Table, TableHead, TableBody, TableRow, TableCell, Dialog, DialogTitle,
  DialogContent, DialogActions, Alert,
} from '@mui/material'
import {
  ArrowBackRounded, AddRounded, DeleteOutlineRounded,
  KeyboardArrowUpRounded, KeyboardArrowDownRounded,
} from '@mui/icons-material'
import client from '../../api/client'
import { getSubjects, getGroups, getMyTeacherProfile, getAssignments } from '../../api/resources'
import type { Subject, Group, TeachingAssignment } from '../../api/resources'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TestOut {
  id: number; title: string; description: string | null; subject_id: number
  status: 'draft' | 'published' | 'archived'
  time_limit_minutes: number | null; attempts_allowed: number
  passing_score_pct: number; questions_count: number | null
  shuffle_questions: boolean; shuffle_options: boolean; show_results: boolean
  available_from: string | null; available_to: string | null
}

interface Item { id: string; text: string; image_url: string | null }

interface TQOut {
  tq_id: number; order_num: number; score_max: number
  id: number; topic_id: number; question_type: string; difficulty: string
  body: string; image_url: string | null; explanation: string | null; options: any
}

interface Topic { id: number; subject_id: number; title: string }
interface TestAssignment { id: number; test_id: number; group_id: number; student_id: number | null; available_from: string | null; available_to: string | null }

type QType = 'single_choice' | 'multiple_choice' | 'text_input' | 'matching'
const QTYPES: { value: QType; label: string }[] = [
  { value: 'single_choice',   label: 'Один вариант' },
  { value: 'multiple_choice', label: 'Несколько вариантов' },
  { value: 'text_input',      label: 'Текстовый ответ' },
  { value: 'matching',        label: 'На соответствие' },
]
const DIFFICULTIES = [
  { value: 'easy',   label: 'Лёгкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'hard',   label: 'Сложный' },
]

const STATUS_SX: Record<string, { bgcolor: string; color: string }> = {
  draft:     { bgcolor: '#F1F5F9', color: '#64748b' },
  published: { bgcolor: '#D4EDDF', color: '#347856' },
  archived:  { bgcolor: '#FEF3C7', color: '#92400E' },
}
const STATUS_LABEL: Record<string, string> = { draft: 'Черновик', published: 'Опубликован', archived: 'Архив' }
const QTYPE_LABEL: Record<string, string> = {
  single_choice: 'Один', multiple_choice: 'Несколько', text_input: 'Текст', matching: 'Соответствие',
}
const DIFF_SX: Record<string, { bgcolor: string; color: string }> = {
  easy:   { bgcolor: '#DCFCE7', color: '#16A34A' },
  medium: { bgcolor: '#FEF3C7', color: '#92400E' },
  hard:   { bgcolor: '#FEE2E2', color: '#DC2626' },
}

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await client.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  return data.url
}

function ImageUploadBtn({ url, onChange }: { url: string | null; onChange: (url: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return
        setUploading(true)
        try { onChange(await uploadImage(file)) } finally { setUploading(false); e.target.value = '' }
      }} />
      {url ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="img" src={url} alt="" sx={{ height: 56, borderRadius: 1, border: 1, borderColor: 'divider', objectFit: 'cover' }} />
          <Button size="small" color="error" onClick={() => onChange(null)} sx={{ fontSize: 11 }}>Удалить</Button>
        </Box>
      ) : (
        <Button size="small" disabled={uploading} onClick={() => ref.current?.click()} sx={{ fontSize: 11, color: 'primary.main' }}>
          {uploading ? 'Загрузка...' : '+ Добавить изображение'}
        </Button>
      )}
    </Box>
  )
}

// ─── Choices editor ───────────────────────────────────────────────────────────

function ChoicesEditor({ type, choices, correct, onChange }: {
  type: 'single_choice' | 'multiple_choice'
  choices: Item[]; correct: string[]
  onChange: (choices: Item[], correct: string[]) => void
}) {
  function addChoice() {
    const id = `c${Date.now()}`
    onChange([...choices, { id, text: '', image_url: null }], correct)
  }
  function removeChoice(id: string) {
    onChange(choices.filter(c => c.id !== id), correct.filter(c => c !== id))
  }
  function updateChoice(id: string, patch: Partial<Item>) {
    onChange(choices.map(c => c.id === id ? { ...c, ...patch } : c), correct)
  }
  function toggleCorrect(id: string) {
    if (type === 'single_choice') {
      onChange(choices, [id])
    } else {
      onChange(choices, correct.includes(id) ? correct.filter(x => x !== id) : [...correct, id])
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {choices.map((ch, i) => (
        <Box key={ch.id} sx={{
          display: 'flex', gap: 1.5, p: 1.5, borderRadius: 1, border: 1,
          borderColor: correct.includes(ch.id) ? '#6EE7B7' : 'divider',
          bgcolor: correct.includes(ch.id) ? '#F0FDF4' : '#F8FAFC',
        }}>
          <Box
            component={type === 'single_choice' ? 'input' : 'input'}
            type={type === 'single_choice' ? 'radio' : 'checkbox'}
            checked={correct.includes(ch.id)}
            onChange={() => toggleCorrect(ch.id)}
            style={{ marginTop: 4, flexShrink: 0, accentColor: '#10B981' }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0, fontWeight: 500 }}>
                {String.fromCharCode(65 + i)}.
              </Typography>
              <Box
                component="input"
                value={ch.text}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateChoice(ch.id, { text: e.target.value })}
                placeholder="Текст варианта..."
                style={{ flex: 1, fontSize: 13, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit' }}
              />
            </Box>
            <ImageUploadBtn url={ch.image_url} onChange={url => updateChoice(ch.id, { image_url: url })} />
          </Box>
          <IconButton size="small" onClick={() => removeChoice(ch.id)} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' }, alignSelf: 'flex-start' }}>
            <DeleteOutlineRounded sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      ))}
      <Button
        variant="outlined"
        size="small"
        startIcon={<AddRounded />}
        onClick={addChoice}
        sx={{ borderStyle: 'dashed', color: 'text.secondary', borderColor: 'divider', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}
      >
        Добавить вариант
      </Button>
    </Box>
  )
}

// ─── Matching editor ──────────────────────────────────────────────────────────

function MatchingEditor({ left, right, correct, onChange }: {
  left: Item[]; right: Item[]; correct: Record<string, string>
  onChange: (left: Item[], right: Item[], correct: Record<string, string>) => void
}) {
  function addLeft() { const id = `l${Date.now()}`; onChange([...left, { id, text: '', image_url: null }], right, correct) }
  function addRight() { const id = `r${Date.now()}`; onChange(left, [...right, { id, text: '', image_url: null }], correct) }
  function updateLeft(id: string, patch: Partial<Item>) { onChange(left.map(x => x.id === id ? { ...x, ...patch } : x), right, correct) }
  function updateRight(id: string, patch: Partial<Item>) { onChange(left, right.map(x => x.id === id ? { ...x, ...patch } : x), correct) }
  function removeLeft(id: string) { const nc = { ...correct }; delete nc[id]; onChange(left.filter(x => x.id !== id), right, nc) }
  function removeRight(id: string) { const nc = Object.fromEntries(Object.entries(correct).filter(([, v]) => v !== id)); onChange(left, right.filter(x => x.id !== id), nc) }
  function setPair(leftId: string, rightId: string) { onChange(left, right, { ...correct, [leftId]: rightId }) }

  function ItemField({ item, onUpdate, onRemove }: { item: Item; onUpdate: (p: Partial<Item>) => void; onRemove: () => void }) {
    return (
      <Box sx={{ display: 'flex', gap: 1, p: 1, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: '#F8FAFC' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            component="input"
            value={item.text}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ text: e.target.value })}
            placeholder="Текст элемента..."
            style={{ width: '100%', fontSize: 13, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit' }}
          />
          <ImageUploadBtn url={item.image_url} onChange={url => onUpdate({ image_url: url })} />
        </Box>
        <IconButton size="small" onClick={onRemove} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' }, alignSelf: 'flex-start' }}>
          <DeleteOutlineRounded sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <Box>
          <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ display: 'block', mb: 1 }}>Левый столбец</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {left.map(item => (
              <ItemField key={item.id} item={item} onUpdate={p => updateLeft(item.id, p)} onRemove={() => removeLeft(item.id)} />
            ))}
            <Button size="small" variant="outlined" onClick={addLeft} sx={{ borderStyle: 'dashed', color: 'text.secondary', borderColor: 'divider', fontSize: 12 }}>+ Добавить</Button>
          </Box>
        </Box>
        <Box>
          <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ display: 'block', mb: 1 }}>Правый столбец</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {right.map(item => (
              <ItemField key={item.id} item={item} onUpdate={p => updateRight(item.id, p)} onRemove={() => removeRight(item.id)} />
            ))}
            <Button size="small" variant="outlined" onClick={addRight} sx={{ borderStyle: 'dashed', color: 'text.secondary', borderColor: 'divider', fontSize: 12 }}>+ Добавить</Button>
          </Box>
        </Box>
      </Box>
      {left.length > 0 && right.length > 0 && (
        <Box>
          <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ display: 'block', mb: 1 }}>Правильные пары</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {left.map(l => (
              <Box key={l.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ flex: 1, fontSize: 13, bgcolor: '#F8FAFC', border: 1, borderColor: 'divider', borderRadius: 1, px: 1.5, py: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.image_url && <Box component="img" src={l.image_url} alt="" sx={{ height: 24, borderRadius: 0.5, mr: 0.5, verticalAlign: 'middle' }} />}
                  <Typography variant="caption">{l.text || <span style={{ color: '#CBD5E1', fontStyle: 'italic' }}>—</span>}</Typography>
                </Box>
                <Typography color="text.disabled" sx={{ flexShrink: 0 }}>→</Typography>
                <Select
                  size="small" value={correct[l.id] ?? ''} onChange={e => setPair(l.id, e.target.value)}
                  displayEmpty sx={{ flex: 1, fontSize: 13 }}
                >
                  <MenuItem value=""><em>Выберите...</em></MenuItem>
                  {right.map(r => <MenuItem key={r.id} value={r.id}>{r.text || `(элемент ${r.id})`}</MenuItem>)}
                </Select>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}

// ─── Question Modal ───────────────────────────────────────────────────────────

function QuestionModal({ testId, subjectId, initial, onSave, onClose }: {
  testId: number; subjectId: number
  initial: TQOut | null
  onSave: () => void; onClose: () => void
}) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [creatingTopic, setCreatingTopic] = useState(false)

  const [topicId, setTopicId] = useState<number>(initial?.topic_id ?? 0)
  const [qtype, setQtype] = useState<QType>((initial?.question_type as QType) ?? 'single_choice')
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? 'medium')
  const [body, setBody] = useState(initial?.body ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null)
  const [scoreMax, setScoreMax] = useState(initial?.score_max ?? 1)
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const initChoices = (): Item[] => initial?.options?.choices ?? [
    { id: 'a', text: '', image_url: null },
    { id: 'b', text: '', image_url: null },
  ]
  const [choices, setChoices] = useState<Item[]>(initChoices)
  const [correct, setCorrect] = useState<string[]>(initial?.options?.correct ?? [])
  const [correctTexts, setCorrectTexts] = useState<string[]>(initial?.options?.correct_texts ?? [''])

  const initLeft = (): Item[] => initial?.options?.left ?? [
    { id: 'l1', text: '', image_url: null }, { id: 'l2', text: '', image_url: null },
  ]
  const initRight = (): Item[] => initial?.options?.right ?? [
    { id: 'r1', text: '', image_url: null }, { id: 'r2', text: '', image_url: null },
  ]
  const [matchLeft, setMatchLeft] = useState<Item[]>(initLeft)
  const [matchRight, setMatchRight] = useState<Item[]>(initRight)
  const [matchCorrect, setMatchCorrect] = useState<Record<string, string>>(initial?.options?.correct ?? {})

  useEffect(() => {
    client.get<Topic[]>('/topics', { params: { subject_id: subjectId } }).then(r => {
      setTopics(r.data)
      if (!topicId && r.data.length > 0) setTopicId(r.data[0].id)
    })
  }, [subjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function createTopic() {
    if (!newTopicTitle.trim()) return
    setCreatingTopic(true)
    try {
      const { data } = await client.post<Topic>('/topics', { subject_id: subjectId, title: newTopicTitle.trim() })
      setTopics(t => [...t, data])
      setTopicId(data.id)
      setNewTopicTitle('')
    } finally { setCreatingTopic(false) }
  }

  function buildOptions() {
    if (qtype === 'single_choice' || qtype === 'multiple_choice') return { choices, correct }
    if (qtype === 'text_input') return { correct_texts: correctTexts.filter(t => t.trim()) }
    if (qtype === 'matching') return { left: matchLeft, right: matchRight, correct: matchCorrect }
    return {}
  }

  async function handleSave() {
    if (!topicId) { setError('Выберите или создайте тему'); return }
    if (!body.trim()) { setError('Введите текст вопроса'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        topic_id: topicId, question_type: qtype, difficulty,
        body: body.trim(), image_url: imageUrl,
        explanation: explanation.trim() || null,
        score_max: scoreMax, options: buildOptions(), is_active: true,
      }
      if (initial?.id) {
        await client.patch(`/questions/${initial.id}`, payload)
      } else {
        const { data } = await client.post<{ id: number }>('/questions', payload)
        await client.post(`/tests/${testId}/questions`, { question_id: data.id, order_num: 99, score_max: scoreMax })
      }
      onSave()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Ошибка сохранения')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>{initial ? 'Редактировать вопрос' : 'Новый вопрос'}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Topic */}
          <Box>
            <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>Тема</Typography>
            {topics.length > 0 && (
              <TextField select fullWidth size="small" value={topicId} onChange={e => setTopicId(Number(e.target.value))} sx={{ mb: 1 }}>
                {topics.map(t => <MenuItem key={t.id} value={t.id}>{t.title}</MenuItem>)}
              </TextField>
            )}
            {topics.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Тем нет — создайте первую:</Typography>
            )}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small" value={newTopicTitle} onChange={e => setNewTopicTitle(e.target.value)}
                placeholder="Название новой темы..." sx={{ flex: 1 }}
              />
              <Button size="small" variant="outlined" onClick={createTopic} disabled={creatingTopic || !newTopicTitle.trim()}>
                Создать
              </Button>
            </Box>
          </Box>

          {/* Type + Difficulty + Score */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            <TextField select label="Тип" size="small" value={qtype} onChange={e => setQtype(e.target.value as QType)}>
              {QTYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <TextField select label="Сложность" size="small" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
              {DIFFICULTIES.map(d => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
            </TextField>
            <TextField label="Баллы" size="small" type="number" value={scoreMax}
              onChange={e => setScoreMax(Number(e.target.value))}
              inputProps={{ min: 0.5, max: 100, step: 0.5 }} />
          </Box>

          {/* Body */}
          <Box>
            <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>Текст вопроса</Typography>
            <TextField fullWidth multiline rows={3} size="small" value={body}
              onChange={e => setBody(e.target.value)} placeholder="Введите текст вопроса..." />
            <ImageUploadBtn url={imageUrl} onChange={setImageUrl} />
          </Box>

          {/* Type-specific */}
          <Box>
            <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {qtype === 'matching' ? 'Элементы и пары' : 'Варианты ответа'}
            </Typography>
            {(qtype === 'single_choice' || qtype === 'multiple_choice') && (
              <ChoicesEditor type={qtype} choices={choices} correct={correct}
                onChange={(c, cr) => { setChoices(c); setCorrect(cr) }} />
            )}
            {qtype === 'text_input' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Перечислите все допустимые формулировки правильного ответа (регистр не важен):
                </Typography>
                {correctTexts.map((t, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      fullWidth size="small" value={t}
                      onChange={e => { const a = [...correctTexts]; a[i] = e.target.value; setCorrectTexts(a) }}
                      placeholder={`Вариант ответа ${i + 1}...`}
                    />
                    {correctTexts.length > 1 && (
                      <IconButton size="small" onClick={() => setCorrectTexts(correctTexts.filter((_, j) => j !== i))}
                        sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                        <DeleteOutlineRounded sx={{ fontSize: 18 }} />
                      </IconButton>
                    )}
                  </Box>
                ))}
                <Button size="small" startIcon={<AddRounded />} onClick={() => setCorrectTexts([...correctTexts, ''])} sx={{ alignSelf: 'flex-start' }}>
                  Добавить вариант
                </Button>
              </Box>
            )}
            {qtype === 'matching' && (
              <MatchingEditor
                left={matchLeft} right={matchRight} correct={matchCorrect}
                onChange={(l, r, c) => { setMatchLeft(l); setMatchRight(r); setMatchCorrect(c) }}
              />
            )}
          </Box>

          {/* Explanation */}
          <Box>
            <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
              Пояснение (показывается после ответа)
            </Typography>
            <TextField fullWidth multiline rows={2} size="small" value={explanation}
              onChange={e => setExplanation(e.target.value)} placeholder="Необязательно..." />
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>Отмена</Button>
        <Button variant="contained" disabled={saving} onClick={handleSave}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function TestEditorPage() {
  const { id } = useParams<{ id: string }>()
  const testId = Number(id)
  const navigate = useNavigate()

  const [test, setTest] = useState<TestOut | null>(null)
  const [questions, setQuestions] = useState<TQOut[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [allowedGroupIds, setAllowedGroupIds] = useState<Set<number>>(new Set())
  const [assignments, setAssignments] = useState<TestAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0) // 0=settings 1=questions 2=assign
  const [modal, setModal] = useState<TQOut | null | 'new'>(null)
  const [saving, setSaving] = useState(false)

  const [groupStudents, setGroupStudents] = useState<Record<number, { id: number; first_name: string; last_name: string; middle_name: string | null }[]>>({})
  const [newStudentAssign, setNewStudentAssign] = useState<{ groupId: number | null; studentId: number | null; from: string; to: string }>({ groupId: null, studentId: null, from: '', to: '' })
  const [assigningStudent, setAssigningStudent] = useState(false)
  const [form, setForm] = useState<Partial<TestOut>>({})

  useEffect(() => {
    Promise.all([
      client.get<TestOut>(`/tests/${testId}`).then(r => r.data),
      client.get<TQOut[]>(`/tests/${testId}/questions`).then(r => r.data),
      client.get<TestAssignment[]>(`/tests/${testId}/assignments`).then(r => r.data),
      getSubjects(),
      getGroups(),
      getMyTeacherProfile().then(t => getAssignments(t.id)).catch(() => [] as TeachingAssignment[]),
    ]).then(([t, qs, ta, subs, grps, myAsgns]) => {
      setTest(t); setForm(t); setQuestions(qs); setAssignments(ta)
      setSubjects(subs); setGroups(grps)
      const ids = new Set(
        myAsgns
          .filter((a: TeachingAssignment) => a.subject_id === t.subject_id)
          .map((a: TeachingAssignment) => a.group_id)
      )
      setAllowedGroupIds(ids)
    }).finally(() => setLoading(false))
  }, [testId])

  async function reloadQuestions() {
    const { data } = await client.get<TQOut[]>(`/tests/${testId}/questions`)
    setQuestions(data)
  }

  async function saveSettings() {
    setSaving(true)
    try {
      const { data } = await client.patch<TestOut>(`/tests/${testId}`, form)
      setTest(data); setForm(data)
    } finally { setSaving(false) }
  }

  async function setStatus(status: string) {
    const { data } = await client.patch<TestOut>(`/tests/${testId}`, { status })
    setTest(data); setForm(data)
  }

  async function deleteQuestion(tq: TQOut) {
    if (!confirm('Удалить вопрос из теста?')) return
    await client.delete(`/tests/${testId}/questions/${tq.id}`)
    await reloadQuestions()
  }

  async function moveQuestion(tq: TQOut, dir: -1 | 1) {
    const idx = questions.findIndex(q => q.tq_id === tq.tq_id)
    const other = questions[idx + dir]
    if (!other) return
    const newOrder = [...questions]
    newOrder[idx] = { ...other }
    newOrder[idx + dir] = { ...tq }
    setQuestions(newOrder)
  }

  useEffect(() => {
    if (tab !== 2 || allowedGroupIds.size === 0) return
    for (const gid of allowedGroupIds) {
      if (groupStudents[gid]) continue
      client.get<{ id: number; first_name: string; last_name: string; middle_name: string | null }[]>(
        '/students', { params: { group_id: gid } }
      ).then(r => { setGroupStudents(prev => ({ ...prev, [gid]: r.data })) })
    }
  }, [tab, allowedGroupIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const assignedGroupIds = new Set(assignments.filter(a => a.student_id == null).map(a => a.group_id))
  const studentAssignments = assignments.filter(a => a.student_id != null)
  const [assignDates, setAssignDates] = useState<Record<number, { from: string; to: string }>>({})

  async function toggleAssign(groupId: number) {
    const existing = assignments.find(a => a.group_id === groupId && a.student_id == null)
    if (existing) {
      await client.delete(`/tests/${testId}/assignments/${existing.id}`)
      setAssignments(a => a.filter(x => x.id !== existing.id))
    } else {
      const dates = assignDates[groupId]
      const { data } = await client.post<TestAssignment>(`/tests/${testId}/assign`, {
        test_id: testId, group_id: groupId, student_id: null,
        available_from: dates?.from || null, available_to: dates?.to || null,
      })
      setAssignments(a => [...a, data])
    }
  }

  async function assignToStudent() {
    const { groupId, studentId, from, to } = newStudentAssign
    if (!groupId || !studentId) return
    setAssigningStudent(true)
    try {
      const { data } = await client.post<TestAssignment>(`/tests/${testId}/assign`, {
        test_id: testId, group_id: groupId, student_id: studentId,
        available_from: from || null, available_to: to || null,
      })
      setAssignments(a => [...a, data])
      setNewStudentAssign({ groupId, studentId: null, from: '', to: '' })
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? 'Ошибка назначения')
    } finally { setAssigningStudent(false) }
  }

  if (loading || !test) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>

  const subjectName = subjects.find(s => s.id === test.subject_id)?.name ?? '—'
  const totalScore = questions.reduce((s, q) => s + q.score_max, 0)

  return (
    <Box sx={{ p: 4, maxWidth: 900 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/tests')} sx={{ mt: 0.5, color: 'text.secondary' }}>
          <ArrowBackRounded />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="h5" fontWeight={700} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{test.title}</Typography>
            <Chip label={STATUS_LABEL[test.status]} size="small" sx={STATUS_SX[test.status]} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {subjectName} · {questions.length} вопросов · {totalScore.toFixed(1)} баллов
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, flexWrap: 'wrap' }}>
          {(['draft', 'published', 'archived'] as const).filter(s => s !== test.status).map(s => {
            const labels: Record<string, string> = { draft: 'Черновик', published: 'Опубликовать', archived: 'В архив' }
            const sxMap: Record<string, object> = {
              draft: { bgcolor: '#F1F5F9', color: '#475569', '&:hover': { bgcolor: '#E2E8F0' } },
              published: { bgcolor: '#059669', color: 'white', '&:hover': { bgcolor: '#047857' } },
              archived: { bgcolor: '#FEF3C7', color: '#92400E', '&:hover': { bgcolor: '#FDE68A' } },
            }
            return (
              <Button key={s} size="small" onClick={() => setStatus(s)} sx={{ borderRadius: 1.5, ...sxMap[s] }}>
                {labels[s]}
              </Button>
            )
          })}
          <Button
            size="small"
            onClick={async () => {
              if (!confirm('Удалить тест? Это действие нельзя отменить.')) return
              try { await client.delete(`/tests/${testId}`); navigate('/tests') }
              catch (err: any) { alert(err?.response?.data?.detail ?? 'Ошибка удаления') }
            }}
            sx={{ bgcolor: '#FEF2F2', color: 'error.main', '&:hover': { bgcolor: '#FEE2E2' }, borderRadius: 1.5 }}
          >
            Удалить
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Настройки" />
        <Tab label={`Вопросы (${questions.length})`} />
        <Tab label="Назначение" />
      </Tabs>

      {/* ── Settings tab ── */}
      {tab === 0 && (
        <Paper elevation={1} sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField label="Название" fullWidth size="small" value={form.title ?? ''}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <TextField label="Описание" fullWidth multiline rows={3} size="small" value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              <TextField label="Лимит времени (мин)" size="small" type="number"
                value={form.time_limit_minutes ?? ''}
                onChange={e => setForm(f => ({ ...f, time_limit_minutes: e.target.value ? Number(e.target.value) : null }))}
                placeholder="Без ограничений" />
              <TextField label="Попыток" size="small" type="number" value={form.attempts_allowed ?? 1}
                onChange={e => setForm(f => ({ ...f, attempts_allowed: Number(e.target.value) }))}
                inputProps={{ min: 1, max: 99 }} />
              <TextField label="Порог сдачи (%)" size="small" type="number" value={form.passing_score_pct ?? 60}
                onChange={e => setForm(f => ({ ...f, passing_score_pct: Number(e.target.value) }))}
                inputProps={{ min: 0, max: 100 }} />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField label="Доступен с" size="small" type="datetime-local"
                value={form.available_from?.slice(0, 16) ?? ''}
                onChange={e => setForm(f => ({ ...f, available_from: e.target.value || null }))}
                InputLabelProps={{ shrink: true }} />
              <TextField label="Доступен до" size="small" type="datetime-local"
                value={form.available_to?.slice(0, 16) ?? ''}
                onChange={e => setForm(f => ({ ...f, available_to: e.target.value || null }))}
                InputLabelProps={{ shrink: true }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 3 }}>
              {[
                { key: 'shuffle_questions', label: 'Перемешивать вопросы' },
                { key: 'shuffle_options',   label: 'Перемешивать варианты' },
                { key: 'show_results',      label: 'Показывать результаты' },
              ].map(({ key, label }) => (
                <FormControlLabel
                  key={key}
                  control={
                    <Checkbox
                      size="small"
                      checked={!!(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                    />
                  }
                  label={<Typography variant="body2">{label}</Typography>}
                />
              ))}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" disabled={saving} onClick={saveSettings}>
                {saving ? 'Сохранение...' : 'Сохранить настройки'}
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {/* ── Questions tab ── */}
      {tab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {questions.length === 0 && (
            <Paper sx={{ p: 8, textAlign: 'center' }}><Typography color="text.secondary">Вопросов пока нет</Typography></Paper>
          )}
          {questions.map((q, i) => (
            <Paper key={q.tq_id} elevation={1} sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              {/* Order controls */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flexShrink: 0, pt: 0.25 }}>
                <IconButton size="small" disabled={i === 0} onClick={() => moveQuestion(q, -1)} sx={{ p: 0, color: 'text.disabled' }}>
                  <KeyboardArrowUpRounded sx={{ fontSize: 16 }} />
                </IconButton>
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ width: 20, textAlign: 'center' }}>{i + 1}</Typography>
                <IconButton size="small" disabled={i === questions.length - 1} onClick={() => moveQuestion(q, 1)} sx={{ p: 0, color: 'text.disabled' }}>
                  <KeyboardArrowDownRounded sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
              {/* Content */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
                  <Chip label={QTYPE_LABEL[q.question_type] ?? q.question_type} size="small" sx={{ bgcolor: '#DBEAFE', color: '#1D4ED8', fontWeight: 600 }} />
                  <Chip label={q.difficulty} size="small" sx={DIFF_SX[q.difficulty] ?? { bgcolor: '#F1F5F9', color: '#64748b' }} />
                  <Typography variant="caption" color="text.disabled">{q.score_max} б.</Typography>
                </Box>
                {q.image_url && <Box component="img" src={q.image_url} alt="" sx={{ height: 48, borderRadius: 1, mb: 0.75, objectFit: 'cover' }} />}
                <Typography variant="body2" sx={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {q.body}
                </Typography>
              </Box>
              {/* Actions */}
              <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                <Button size="small" variant="outlined" onClick={() => setModal(q)} sx={{ borderColor: 'divider', color: 'text.primary' }}>
                  Изменить
                </Button>
                <Button size="small" variant="outlined" color="error" onClick={() => deleteQuestion(q)} sx={{ borderColor: '#FCA5A5' }}>
                  Удалить
                </Button>
              </Box>
            </Paper>
          ))}
          <Button
            fullWidth variant="outlined" startIcon={<AddRounded />} onClick={() => setModal('new')}
            sx={{ borderStyle: 'dashed', py: 1.5, color: 'primary.main', borderColor: '#BFDBFE', '&:hover': { borderColor: 'primary.main', bgcolor: '#EFF6FF' } }}
          >
            Добавить вопрос
          </Button>
        </Box>
      )}

      {/* ── Assign tab ── */}
      {tab === 2 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* By group */}
          <Paper elevation={2} sx={{ overflow: 'hidden' }}>
            <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={600}>По группе</Typography>
              <Typography variant="caption" color="text.secondary">Доступ получат все студенты группы</Typography>
            </Box>
            {allowedGroupIds.size === 0 ? (
              <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">Нет групп, которым вы ведёте этот предмет</Typography>
              </Box>
            ) : (
              <Table size="small">
                <TableBody>
                  {groups.filter(g => allowedGroupIds.has(g.id)).map(g => {
                    const isAssigned = assignedGroupIds.has(g.id)
                    return (
                      <TableRow key={g.id}>
                        <TableCell sx={{ width: 40 }}>
                          <Checkbox size="small" checked={isAssigned} onChange={() => toggleAssign(g.id)} />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500, width: 140 }}>{g.name}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <TextField
                              size="small" type="datetime-local"
                              value={assignDates[g.id]?.from ?? ''}
                              onChange={e => setAssignDates(d => ({ ...d, [g.id]: { ...d[g.id], from: e.target.value } }))}
                              InputLabelProps={{ shrink: true }} sx={{ '& input': { fontSize: 12 } }}
                            />
                            <Typography color="text.disabled">—</Typography>
                            <TextField
                              size="small" type="datetime-local"
                              value={assignDates[g.id]?.to ?? ''}
                              onChange={e => setAssignDates(d => ({ ...d, [g.id]: { ...d[g.id], to: e.target.value } }))}
                              InputLabelProps={{ shrink: true }} sx={{ '& input': { fontSize: 12 } }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell sx={{ width: 80 }}>
                          {isAssigned && <Chip label="Выдан" size="small" sx={{ bgcolor: '#D1FAE5', color: '#065F46' }} />}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </Paper>

          {/* Personally to student */}
          <Paper elevation={2} sx={{ overflow: 'hidden' }}>
            <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={600}>Персонально студенту</Typography>
              <Typography variant="caption" color="text.secondary">Переопределяет групповое назначение для конкретного студента</Typography>
            </Box>

            {allowedGroupIds.size > 0 && (
              <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Группа</Typography>
                  <Select
                    size="small" value={newStudentAssign.groupId ?? ''}
                    onChange={e => setNewStudentAssign(s => ({ ...s, groupId: Number(e.target.value), studentId: null }))}
                    displayEmpty sx={{ minWidth: 140, fontSize: 14 }}
                  >
                    <MenuItem value=""><em>Выберите группу</em></MenuItem>
                    {groups.filter(g => allowedGroupIds.has(g.id)).map(g => (
                      <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
                    ))}
                  </Select>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Студент</Typography>
                  <Select
                    size="small" value={newStudentAssign.studentId ?? ''}
                    onChange={e => setNewStudentAssign(s => ({ ...s, studentId: Number(e.target.value) }))}
                    disabled={!newStudentAssign.groupId}
                    displayEmpty sx={{ minWidth: 180, fontSize: 14 }}
                  >
                    <MenuItem value=""><em>Выберите студента</em></MenuItem>
                    {(newStudentAssign.groupId ? groupStudents[newStudentAssign.groupId] ?? [] : []).map(s => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.last_name} {s.first_name}{s.middle_name ? ` ${s.middle_name}` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Доступен с</Typography>
                  <TextField size="small" type="datetime-local" value={newStudentAssign.from}
                    onChange={e => setNewStudentAssign(s => ({ ...s, from: e.target.value }))}
                    InputLabelProps={{ shrink: true }} sx={{ '& input': { fontSize: 12 } }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Доступен до</Typography>
                  <TextField size="small" type="datetime-local" value={newStudentAssign.to}
                    onChange={e => setNewStudentAssign(s => ({ ...s, to: e.target.value }))}
                    InputLabelProps={{ shrink: true }} sx={{ '& input': { fontSize: 12 } }} />
                </Box>
                <Button
                  variant="contained" size="small"
                  disabled={!newStudentAssign.groupId || !newStudentAssign.studentId || assigningStudent}
                  onClick={assignToStudent}
                >
                  {assigningStudent ? 'Выдача...' : 'Выдать'}
                </Button>
              </Box>
            )}

            {studentAssignments.length === 0 ? (
              <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">Персональных назначений нет</Typography>
              </Box>
            ) : (
              <Table size="small">
                <TableBody>
                  {studentAssignments.map(sa => {
                    const grp = groups.find(g => g.id === sa.group_id)
                    const students = groupStudents[sa.group_id] ?? []
                    const st = students.find(s => s.id === sa.student_id)
                    const stName = st
                      ? `${st.last_name} ${st.first_name}${st.middle_name ? ` ${st.middle_name}` : ''}`
                      : `Студент #${sa.student_id}`
                    return (
                      <TableRow key={sa.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{stName}</Typography>
                          <Typography variant="caption" color="text.disabled">
                            {grp?.name ?? `Группа ${sa.group_id}`}
                            {(sa.available_from || sa.available_to) && (
                              <span>
                                {' · '}
                                {sa.available_from ? new Date(sa.available_from).toLocaleDateString('ru') : ''}
                                {sa.available_from && sa.available_to ? ' — ' : ''}
                                {sa.available_to ? new Date(sa.available_to).toLocaleDateString('ru') : ''}
                              </span>
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" color="error" onClick={async () => {
                            await client.delete(`/tests/${testId}/assignments/${sa.id}`)
                            setAssignments(a => a.filter(x => x.id !== sa.id))
                          }}>
                            Удалить
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Box>
      )}

      {/* Question modal */}
      {modal !== null && (
        <QuestionModal
          testId={testId}
          subjectId={test.subject_id}
          initial={modal === 'new' ? null : modal}
          onSave={async () => { await reloadQuestions(); setModal(null) }}
          onClose={() => setModal(null)}
        />
      )}
    </Box>
  )
}
