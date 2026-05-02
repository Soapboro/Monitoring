import { useEffect, useMemo, useState } from 'react'
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
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { AddRounded, DeleteOutlineRounded, EditRounded, SearchRounded } from '@mui/icons-material'
import client from '../../api/client'
import { getSubjects } from '../../api/resources'
import type { Subject } from '../../api/resources'

interface Topic { id: number; subject_id: number; title: string }
interface QuestionOut {
  id: number
  topic_id: number
  question_type: QType
  difficulty: Difficulty
  body: string
  explanation: string | null
  score_max: number
  options: any
  is_active: boolean
}

type QType = 'single_choice' | 'multiple_choice' | 'text_input' | 'matching'
type Difficulty = 'easy' | 'medium' | 'hard'

const QTYPE_LABEL: Record<string, string> = {
  single_choice: 'Один вариант',
  multiple_choice: 'Несколько вариантов',
  text_input: 'Текстовый ответ',
  matching: 'Соответствие',
}

const DIFF_LABEL: Record<Difficulty, string> = {
  easy: 'Лёгкий',
  medium: 'Средний',
  hard: 'Сложный',
}

const DIFF_SX: Record<string, { bgcolor: string; color: string }> = {
  easy: { bgcolor: '#DCFCE7', color: '#16A34A' },
  medium: { bgcolor: '#FEF3C7', color: '#92400E' },
  hard: { bgcolor: '#FEE2E2', color: '#DC2626' },
}

export default function QuestionBankPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [questions, setQuestions] = useState<QuestionOut[]>([])
  const [subjectId, setSubjectId] = useState<number | ''>('')
  const [topicId, setTopicId] = useState<number | ''>('')
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<QuestionOut | null | 'new'>(null)

  async function loadQuestions() {
    setLoading(true)
    const params: Record<string, unknown> = { is_active: true }
    if (subjectId) params.subject_id = subjectId
    if (topicId) params.topic_id = topicId
    if (difficulty) params.difficulty = difficulty
    if (search.trim()) params.search = search.trim()
    const { data } = await client.get<QuestionOut[]>('/questions', { params })
    setQuestions(data)
    setLoading(false)
  }

  useEffect(() => {
    getSubjects().then(setSubjects)
  }, [])

  useEffect(() => {
    if (!subjectId) {
      setTopics([])
      setTopicId('')
      return
    }
    client.get<Topic[]>('/topics', { params: { subject_id: subjectId } }).then(r => setTopics(r.data))
  }, [subjectId])

  useEffect(() => {
    loadQuestions()
  }, [subjectId, topicId, difficulty]) // eslint-disable-line react-hooks/exhaustive-deps

  const topicById = useMemo(() => new Map(topics.map(t => [t.id, t])), [topics])

  async function deleteQuestion(question: QuestionOut) {
    if (!confirm('Удалить вопрос из банка? Он также будет удалён из тестов, где используется.')) return
    await client.delete(`/questions/${question.id}`)
    await loadQuestions()
  }

  return (
    <Box sx={{ p: 4, maxWidth: 1100 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Банк вопросов</Typography>
          <Typography variant="body2" color="text.secondary">Вопросы, которые можно переиспользовать в тестах</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRounded />} onClick={() => setModal('new')}>
          Новый вопрос
        </Button>
      </Box>

      <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.3fr 1.3fr 1fr 1.5fr auto' }, gap: 1.5 }}>
          <TextField select label="Предмет" size="small" value={subjectId} onChange={e => { setSubjectId(e.target.value ? Number(e.target.value) : ''); setTopicId('') }}>
            <MenuItem value="">Все предметы</MenuItem>
            {subjects.map(subject => <MenuItem key={subject.id} value={subject.id}>{subject.name}</MenuItem>)}
          </TextField>
          <TextField select label="Тема" size="small" value={topicId} onChange={e => setTopicId(e.target.value ? Number(e.target.value) : '')} disabled={!subjectId}>
            <MenuItem value="">Все темы</MenuItem>
            {topics.map(topic => <MenuItem key={topic.id} value={topic.id}>{topic.title}</MenuItem>)}
          </TextField>
          <TextField select label="Сложность" size="small" value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty | '')}>
            <MenuItem value="">Любая</MenuItem>
            {Object.entries(DIFF_LABEL).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
          <TextField label="Поиск" size="small" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') loadQuestions() }} />
          <Button variant="outlined" startIcon={<SearchRounded />} onClick={loadQuestions}>Найти</Button>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ p: 5, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
      ) : questions.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">Вопросов пока нет</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {questions.map(question => (
            <Paper key={question.id} elevation={1} sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                  <Chip label={QTYPE_LABEL[question.question_type] ?? question.question_type} size="small" sx={{ bgcolor: '#DBEAFE', color: '#1D4ED8' }} />
                  <Chip label={DIFF_LABEL[question.difficulty] ?? question.difficulty} size="small" sx={DIFF_SX[question.difficulty]} />
                  <Chip label={`${question.score_max} б.`} size="small" />
                  {topicById.get(question.topic_id) && <Chip label={topicById.get(question.topic_id)!.title} size="small" variant="outlined" />}
                </Box>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{question.body}</Typography>
                {question.explanation && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    {question.explanation}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton size="small" onClick={() => setModal(question)}><EditRounded fontSize="small" /></IconButton>
                <IconButton size="small" color="error" onClick={() => deleteQuestion(question)}><DeleteOutlineRounded fontSize="small" /></IconButton>
              </Box>
            </Paper>
          ))}
        </Stack>
      )}

      {modal !== null && (
        <QuestionFormModal
          subjects={subjects}
          initial={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={async () => { setModal(null); await loadQuestions() }}
        />
      )}
    </Box>
  )
}

function QuestionFormModal({ subjects, initial, onClose, onSave }: {
  subjects: Subject[]
  initial: QuestionOut | null
  onClose: () => void
  onSave: () => void
}) {
  const [subjectId, setSubjectId] = useState<number | ''>('')
  const [topics, setTopics] = useState<Topic[]>([])
  const [topicId, setTopicId] = useState<number | ''>(initial?.topic_id ?? '')
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [questionType, setQuestionType] = useState<QType>((initial?.question_type as QType) || 'single_choice')
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? 'medium')
  const [body, setBody] = useState(initial?.body ?? '')
  const [scoreMax, setScoreMax] = useState(initial?.score_max ?? 1)
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const [choices, setChoices] = useState<string[]>(() => (initial?.options?.choices ?? [{ text: '' }, { text: '' }]).map((c: any) => c.text ?? ''))
  const [correct, setCorrect] = useState<number[]>(() => {
    const ids: string[] = initial?.options?.correct ?? []
    const opts: any[] = initial?.options?.choices ?? []
    return ids.map(id => opts.findIndex(c => c.id === id)).filter(i => i >= 0)
  })
  const [correctTexts, setCorrectTexts] = useState<string[]>(initial?.options?.correct_texts ?? [''])
  const [matchPairs, setMatchPairs] = useState<{ left: string; right: string }[]>(() => {
    if (initial?.options?.left && initial?.options?.right && initial?.options?.correct) {
      return initial.options.left.map((left: any) => {
        const rightId = initial.options.correct[left.id]
        const right = initial.options.right.find((item: any) => item.id === rightId)
        return { left: left.text ?? '', right: right?.text ?? '' }
      })
    }
    return [{ left: '', right: '' }, { left: '', right: '' }]
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!initial || subjects.length === 0 || subjectId) return
    Promise.all(subjects.map(subject => client.get<Topic[]>('/topics', { params: { subject_id: subject.id } }).then(r => ({ subject, topics: r.data }))))
      .then(rows => {
        const row = rows.find(item => item.topics.some(topic => topic.id === initial.topic_id))
        if (row) setSubjectId(row.subject.id)
      })
  }, [initial, subjects, subjectId])

  useEffect(() => {
    if (!subjectId) {
      setTopics([])
      return
    }
    client.get<Topic[]>('/topics', { params: { subject_id: subjectId } }).then(r => {
      setTopics(r.data)
      if (!topicId && r.data.length > 0) setTopicId(r.data[0].id)
    })
  }, [subjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function createTopic() {
    if (!subjectId || !newTopicTitle.trim()) return
    const { data } = await client.post<Topic>('/topics', { subject_id: subjectId, title: newTopicTitle.trim() })
    setTopics(items => [...items, data])
    setTopicId(data.id)
    setNewTopicTitle('')
  }

  function buildOptions() {
    if (questionType === 'text_input') return { correct_texts: correctTexts.map(t => t.trim()).filter(Boolean) }
    if (questionType === 'matching') {
      const pairs = matchPairs.filter(pair => pair.left.trim() && pair.right.trim())
      return {
        left: pairs.map((pair, index) => ({ id: `l${index}`, text: pair.left.trim(), image_url: null })),
        right: pairs.map((pair, index) => ({ id: `r${index}`, text: pair.right.trim(), image_url: null })),
        correct: Object.fromEntries(pairs.map((_, index) => [`l${index}`, `r${index}`])),
      }
    }
    const normalized = choices.map((text, index) => ({ id: `c${index}`, text: text.trim(), image_url: null }))
    return { choices: normalized, correct: correct.map(index => `c${index}`) }
  }

  async function save() {
    if (!topicId) { setError('Выберите или создайте тему'); return }
    if (!body.trim()) { setError('Введите текст вопроса'); return }
    if ((questionType === 'single_choice' || questionType === 'multiple_choice') && choices.filter(c => c.trim()).length < 2) { setError('Добавьте минимум два варианта ответа'); return }
    if ((questionType === 'single_choice' || questionType === 'multiple_choice') && correct.length === 0) { setError('Отметьте правильный ответ'); return }
    if (questionType === 'text_input' && correctTexts.every(t => !t.trim())) { setError('Добавьте правильный текстовый ответ'); return }
    if (questionType === 'matching' && matchPairs.filter(pair => pair.left.trim() && pair.right.trim()).length < 2) { setError('Добавьте минимум две пары соответствия'); return }

    setSaving(true)
    setError('')
    const payload = {
      topic_id: Number(topicId),
      question_type: questionType,
      difficulty,
      body: body.trim(),
      explanation: explanation.trim() || null,
      score_max: scoreMax,
      options: buildOptions(),
      is_active: true,
    }
    try {
      if (initial) await client.patch(`/questions/${initial.id}`, payload)
      else await client.post('/questions', payload)
      onSave()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Ошибка сохранения')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{initial ? 'Редактировать вопрос' : 'Новый вопрос'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField select label="Предмет" size="small" value={subjectId} onChange={e => { setSubjectId(Number(e.target.value)); setTopicId('') }}>
            {subjects.map(subject => <MenuItem key={subject.id} value={subject.id}>{subject.name}</MenuItem>)}
          </TextField>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField select label="Тема" size="small" value={topicId} onChange={e => setTopicId(Number(e.target.value))} disabled={!subjectId || topics.length === 0} sx={{ flex: 1 }}>
              {topics.map(topic => <MenuItem key={topic.id} value={topic.id}>{topic.title}</MenuItem>)}
            </TextField>
            <TextField size="small" placeholder="Новая тема" value={newTopicTitle} onChange={e => setNewTopicTitle(e.target.value)} sx={{ flex: 1 }} />
            <Button variant="outlined" onClick={createTopic} disabled={!subjectId || !newTopicTitle.trim()}>Создать</Button>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 1.5 }}>
            <TextField select label="Тип" size="small" value={questionType} onChange={e => { setQuestionType(e.target.value as QType); setCorrect([]) }}>
              <MenuItem value="single_choice">Один вариант</MenuItem>
              <MenuItem value="multiple_choice">Несколько вариантов</MenuItem>
              <MenuItem value="text_input">Текстовый ответ</MenuItem>
              <MenuItem value="matching">Соответствие</MenuItem>
            </TextField>
            <TextField select label="Сложность" size="small" value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}>
              {Object.entries(DIFF_LABEL).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>
            <TextField label="Баллы" size="small" type="number" value={scoreMax} onChange={e => setScoreMax(Number(e.target.value))} slotProps={{ htmlInput: { min: 0.5, step: 0.5 } }} />
          </Box>
          <TextField label="Текст вопроса" multiline minRows={3} size="small" value={body} onChange={e => setBody(e.target.value)} />

          {questionType === 'text_input' ? (
            <Stack spacing={1}>
              {correctTexts.map((text, index) => (
                <TextField key={index} label={`Правильный ответ ${index + 1}`} size="small" value={text} onChange={e => setCorrectTexts(items => items.map((item, i) => i === index ? e.target.value : item))} />
              ))}
              <Button variant="outlined" startIcon={<AddRounded />} onClick={() => setCorrectTexts(items => [...items, ''])} sx={{ alignSelf: 'flex-start' }}>Добавить вариант ответа</Button>
            </Stack>
          ) : questionType === 'matching' ? (
            <Stack spacing={1}>
              {matchPairs.map((pair, index) => (
                <Box key={index} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 1 }}>
                  <TextField label={`Левая часть ${index + 1}`} size="small" value={pair.left} onChange={e => setMatchPairs(items => items.map((item, i) => i === index ? { ...item, left: e.target.value } : item))} />
                  <TextField label={`Правая часть ${index + 1}`} size="small" value={pair.right} onChange={e => setMatchPairs(items => items.map((item, i) => i === index ? { ...item, right: e.target.value } : item))} />
                  {matchPairs.length > 2 && <IconButton size="small" onClick={() => setMatchPairs(items => items.filter((_, i) => i !== index))}><DeleteOutlineRounded fontSize="small" /></IconButton>}
                </Box>
              ))}
              <Button variant="outlined" startIcon={<AddRounded />} onClick={() => setMatchPairs(items => [...items, { left: '', right: '' }])} sx={{ alignSelf: 'flex-start' }}>Добавить пару</Button>
            </Stack>
          ) : (
            <Stack spacing={1}>
              {choices.map((choice, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Box
                    component="input"
                    type={questionType === 'single_choice' ? 'radio' : 'checkbox'}
                    checked={correct.includes(index)}
                    onChange={() => {
                      setCorrect(items => questionType === 'single_choice'
                        ? [index]
                        : items.includes(index) ? items.filter(item => item !== index) : [...items, index])
                    }}
                    style={{ accentColor: '#10B981' }}
                  />
                  <TextField label={`Вариант ${index + 1}`} size="small" value={choice} onChange={e => setChoices(items => items.map((item, i) => i === index ? e.target.value : item))} sx={{ flex: 1 }} />
                  {choices.length > 2 && <IconButton size="small" onClick={() => setChoices(items => items.filter((_, i) => i !== index))}><DeleteOutlineRounded fontSize="small" /></IconButton>}
                </Box>
              ))}
              <Button variant="outlined" startIcon={<AddRounded />} onClick={() => setChoices(items => [...items, ''])} sx={{ alignSelf: 'flex-start' }}>Добавить вариант</Button>
            </Stack>
          )}

          <TextField label="Пояснение" multiline minRows={2} size="small" value={explanation} onChange={e => setExplanation(e.target.value)} />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</Button>
      </DialogActions>
    </Dialog>
  )
}
