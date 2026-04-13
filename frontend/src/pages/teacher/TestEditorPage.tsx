import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client from '../../api/client'
import { getSubjects, getGroups } from '../../api/resources'
import type { Subject, Group } from '../../api/resources'

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
interface TestAssignment { id: number; test_id: number; group_id: number; available_from: string | null; available_to: string | null }

type QType = 'single_choice' | 'multiple_choice' | 'text_input' | 'matching'
const QTYPES: { value: QType; label: string }[] = [
  { value: 'single_choice',   label: 'Один вариант' },
  { value: 'multiple_choice', label: 'Несколько вариантов' },
  { value: 'text_input',      label: 'Текстовый ответ' },
  { value: 'matching',        label: 'На соответствие' },
]
const DIFFICULTIES = [
  { value: 'easy', label: 'Лёгкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'hard', label: 'Сложный' },
]
const STATUS_ACTIONS: { value: string; label: string; cls: string }[] = [
  { value: 'draft',     label: 'Черновик',    cls: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
  { value: 'published', label: 'Опубликовать', cls: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  { value: 'archived',  label: 'В архив',     cls: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
]

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
    <div className="flex items-center gap-2 mt-1">
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return
        setUploading(true)
        try { onChange(await uploadImage(file)) } finally { setUploading(false); e.target.value = '' }
      }} />
      {url ? (
        <div className="flex items-center gap-2">
          <img src={url} alt="" className="h-14 rounded border border-slate-200 object-cover" />
          <button type="button" onClick={() => onChange(null)} className="text-xs text-red-500 hover:underline">Удалить</button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50">
          {uploading ? 'Загрузка...' : '+ Добавить изображение'}
        </button>
      )}
    </div>
  )
}

// ─── Choice editor (single / multiple) ───────────────────────────────────────

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
    <div className="space-y-3">
      {choices.map((ch, i) => (
        <div key={ch.id} className={`flex gap-3 p-3 rounded-lg border ${correct.includes(ch.id) ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
          <input
            type={type === 'single_choice' ? 'radio' : 'checkbox'}
            checked={correct.includes(ch.id)}
            onChange={() => toggleCorrect(ch.id)}
            className="mt-1 shrink-0 accent-emerald-600"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 shrink-0">{String.fromCharCode(65 + i)}.</span>
              <input
                value={ch.text} onChange={e => updateChoice(ch.id, { text: e.target.value })}
                placeholder="Текст варианта..."
                className="flex-1 text-sm bg-transparent border-none outline-none"
              />
            </div>
            <ImageUploadBtn url={ch.image_url} onChange={url => updateChoice(ch.id, { image_url: url })} />
          </div>
          <button type="button" onClick={() => removeChoice(ch.id)} className="text-slate-300 hover:text-red-500 shrink-0 text-lg leading-none">&times;</button>
        </div>
      ))}
      <button type="button" onClick={addChoice}
        className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
        + Добавить вариант
      </button>
    </div>
  )
}

// ─── Matching editor ──────────────────────────────────────────────────────────

function MatchingEditor({ left, right, correct, onChange }: {
  left: Item[]; right: Item[]; correct: Record<string, string>
  onChange: (left: Item[], right: Item[], correct: Record<string, string>) => void
}) {
  function addLeft() {
    const id = `l${Date.now()}`
    onChange([...left, { id, text: '', image_url: null }], right, correct)
  }
  function addRight() {
    const id = `r${Date.now()}`
    onChange(left, [...right, { id, text: '', image_url: null }], correct)
  }
  function updateLeft(id: string, patch: Partial<Item>) {
    onChange(left.map(x => x.id === id ? { ...x, ...patch } : x), right, correct)
  }
  function updateRight(id: string, patch: Partial<Item>) {
    onChange(left, right.map(x => x.id === id ? { ...x, ...patch } : x), correct)
  }
  function removeLeft(id: string) {
    const nc = { ...correct }; delete nc[id]
    onChange(left.filter(x => x.id !== id), right, nc)
  }
  function removeRight(id: string) {
    const nc = Object.fromEntries(Object.entries(correct).filter(([, v]) => v !== id))
    onChange(left, right.filter(x => x.id !== id), nc)
  }
  function setPair(leftId: string, rightId: string) {
    onChange(left, right, { ...correct, [leftId]: rightId })
  }

  function ItemField({ item, onUpdate, onRemove }: { item: Item; onUpdate: (p: Partial<Item>) => void; onRemove: () => void }) {
    return (
      <div className="flex gap-2 p-2 border border-slate-200 rounded-lg bg-slate-50">
        <div className="flex-1 min-w-0">
          <input value={item.text} onChange={e => onUpdate({ text: e.target.value })}
            placeholder="Текст элемента..." className="w-full text-sm bg-transparent outline-none" />
          <ImageUploadBtn url={item.image_url} onChange={url => onUpdate({ image_url: url })} />
        </div>
        <button type="button" onClick={onRemove} className="text-slate-300 hover:text-red-500 text-lg leading-none shrink-0">&times;</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Left column */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Левый столбец</p>
          <div className="space-y-2">
            {left.map(item => (
              <ItemField key={item.id} item={item}
                onUpdate={p => updateLeft(item.id, p)}
                onRemove={() => removeLeft(item.id)} />
            ))}
            <button type="button" onClick={addLeft}
              className="w-full py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-400 hover:border-blue-400 hover:text-blue-500">
              + Добавить
            </button>
          </div>
        </div>
        {/* Right column */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Правый столбец</p>
          <div className="space-y-2">
            {right.map(item => (
              <ItemField key={item.id} item={item}
                onUpdate={p => updateRight(item.id, p)}
                onRemove={() => removeRight(item.id)} />
            ))}
            <button type="button" onClick={addRight}
              className="w-full py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-400 hover:border-blue-400 hover:text-blue-500">
              + Добавить
            </button>
          </div>
        </div>
      </div>
      {/* Pairs */}
      {left.length > 0 && right.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Правильные пары</p>
          <div className="space-y-2">
            {left.map(l => (
              <div key={l.id} className="flex items-center gap-3">
                <div className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1 truncate">
                  {l.image_url && <img src={l.image_url} alt="" className="h-6 inline mr-1 rounded" />}
                  {l.text || <span className="text-slate-300 italic">—</span>}
                </div>
                <span className="text-slate-400">→</span>
                <select
                  value={correct[l.id] ?? ''}
                  onChange={e => setPair(l.id, e.target.value)}
                  className="flex-1 text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Выберите...</option>
                  {right.map(r => (
                    <option key={r.id} value={r.id}>{r.text || `(элемент ${r.id})`}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
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

  // Choices state
  const initChoices = (): Item[] => initial?.options?.choices ?? [
    { id: 'a', text: '', image_url: null },
    { id: 'b', text: '', image_url: null },
  ]
  const [choices, setChoices] = useState<Item[]>(initChoices)
  const [correct, setCorrect] = useState<string[]>(initial?.options?.correct ?? [])

  // Text input state
  const [correctTexts, setCorrectTexts] = useState<string[]>(
    initial?.options?.correct_texts ?? ['']
  )

  // Matching state
  const initLeft = (): Item[] => initial?.options?.left ?? [
    { id: 'l1', text: '', image_url: null },
    { id: 'l2', text: '', image_url: null },
  ]
  const initRight = (): Item[] => initial?.options?.right ?? [
    { id: 'r1', text: '', image_url: null },
    { id: 'r2', text: '', image_url: null },
  ]
  const [matchLeft, setMatchLeft] = useState<Item[]>(initLeft)
  const [matchRight, setMatchRight] = useState<Item[]>(initRight)
  const [matchCorrect, setMatchCorrect] = useState<Record<string, string>>(
    initial?.options?.correct ?? {}
  )

  useEffect(() => {
    client.get<Topic[]>('/topics', { params: { subject_id: subjectId } }).then(r => {
      setTopics(r.data)
      if (!topicId && r.data.length > 0) setTopicId(r.data[0].id)
    })
  }, [subjectId])

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
    if (qtype === 'single_choice' || qtype === 'multiple_choice') {
      return { choices, correct }
    }
    if (qtype === 'text_input') {
      return { correct_texts: correctTexts.filter(t => t.trim()) }
    }
    if (qtype === 'matching') {
      return { left: matchLeft, right: matchRight, correct: matchCorrect }
    }
    return {}
  }

  async function handleSave() {
    if (!topicId) return alert('Выберите или создайте тему')
    if (!body.trim()) return alert('Введите текст вопроса')
    setSaving(true)
    try {
      const payload = {
        topic_id: topicId,
        question_type: qtype,
        difficulty,
        body: body.trim(),
        image_url: imageUrl,
        explanation: explanation.trim() || null,
        score_max: scoreMax,
        options: buildOptions(),
        is_active: true,
      }
      if (initial?.id) {
        await client.patch(`/questions/${initial.id}`, payload)
      } else {
        const { data } = await client.post<{ id: number }>('/questions', payload)
        await client.post(`/tests/${testId}/questions`, {
          question_id: data.id,
          order_num: 99,
          score_max: scoreMax,
        })
      }
      onSave()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            {initial ? 'Редактировать вопрос' : 'Новый вопрос'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Topic */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Тема</label>
            {topics.length > 0 ? (
              <select value={topicId} onChange={e => setTopicId(Number(e.target.value))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            ) : (
              <p className="text-sm text-slate-400 mb-2">Тем нет — создайте первую:</p>
            )}
            <div className="flex gap-2 mt-2">
              <input value={newTopicTitle} onChange={e => setNewTopicTitle(e.target.value)}
                placeholder="Название новой темы..."
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={createTopic} disabled={creatingTopic || !newTopicTitle.trim()}
                className="text-sm px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50">
                Создать
              </button>
            </div>
          </div>

          {/* Type + Difficulty + Score */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Тип</label>
              <select value={qtype} onChange={e => setQtype(e.target.value as QType)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {QTYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Сложность</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Баллы</label>
              <input type="number" min={0.5} max={100} step={0.5} value={scoreMax}
                onChange={e => setScoreMax(Number(e.target.value))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Текст вопроса</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={3}
              placeholder="Введите текст вопроса..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            <ImageUploadBtn url={imageUrl} onChange={setImageUrl} />
          </div>

          {/* Type-specific editor */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">
              {qtype === 'matching' ? 'Элементы и пары' : 'Варианты ответа'}
            </label>

            {(qtype === 'single_choice' || qtype === 'multiple_choice') && (
              <ChoicesEditor
                type={qtype} choices={choices} correct={correct}
                onChange={(c, cr) => { setChoices(c); setCorrect(cr) }}
              />
            )}

            {qtype === 'text_input' && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Перечислите все допустимые формулировки правильного ответа (регистр не важен):</p>
                {correctTexts.map((t, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={t} onChange={e => {
                      const a = [...correctTexts]; a[i] = e.target.value; setCorrectTexts(a)
                    }}
                      placeholder={`Вариант ответа ${i + 1}...`}
                      className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    {correctTexts.length > 1 && (
                      <button type="button" onClick={() => setCorrectTexts(correctTexts.filter((_, j) => j !== i))}
                        className="text-slate-300 hover:text-red-500 text-xl">&times;</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setCorrectTexts([...correctTexts, ''])}
                  className="text-sm text-blue-600 hover:underline">+ Добавить вариант</button>
              </div>
            )}

            {qtype === 'matching' && (
              <MatchingEditor
                left={matchLeft} right={matchRight} correct={matchCorrect}
                onChange={(l, r, c) => { setMatchLeft(l); setMatchRight(r); setMatchCorrect(c) }}
              />
            )}
          </div>

          {/* Explanation */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Пояснение (показывается после ответа)</label>
            <textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2}
              placeholder="Необязательно..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500',
  published: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-amber-100 text-amber-700',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Черновик', published: 'Опубликован', archived: 'Архив',
}
const QTYPE_LABEL: Record<string, string> = {
  single_choice: 'Один',
  multiple_choice: 'Несколько',
  text_input: 'Текст',
  matching: 'Соответствие',
}
const DIFF_BADGE: Record<string, string> = {
  easy: 'bg-green-100 text-green-600',
  medium: 'bg-amber-100 text-amber-600',
  hard: 'bg-red-100 text-red-600',
}

export default function TestEditorPage() {
  const { id } = useParams<{ id: string }>()
  const testId = Number(id)
  const navigate = useNavigate()

  const [test, setTest] = useState<TestOut | null>(null)
  const [questions, setQuestions] = useState<TQOut[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [assignments, setAssignments] = useState<TestAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'settings' | 'questions' | 'assign'>('settings')
  const [modal, setModal] = useState<TQOut | null | 'new'>(null)
  const [saving, setSaving] = useState(false)

  // Settings form state
  const [form, setForm] = useState<Partial<TestOut>>({})

  useEffect(() => {
    Promise.all([
      client.get<TestOut>(`/tests/${testId}`).then(r => r.data),
      client.get<TQOut[]>(`/tests/${testId}/questions`).then(r => r.data),
      client.get<TestAssignment[]>(`/tests/${testId}/assignments`).then(r => r.data),
      getSubjects(),
      getGroups(),
    ]).then(([t, qs, ta, subs, grps]) => {
      setTest(t); setForm(t); setQuestions(qs); setAssignments(ta)
      setSubjects(subs); setGroups(grps)
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
    await Promise.all([
      client.patch(`/questions/${tq.id}`, {}), // just to trigger; order via tq
    ])
    // swap order_num via PATCH test question — simpler: just reorder client-side + re-post
    const newOrder = [...questions]
    newOrder[idx] = { ...other }
    newOrder[idx + dir] = { ...tq }
    setQuestions(newOrder)
  }

  // Assign tab
  const assignedGroupIds = new Set(assignments.map(a => a.group_id))
  const [assignDates, setAssignDates] = useState<Record<number, { from: string; to: string }>>({})

  async function toggleAssign(groupId: number) {
    const existing = assignments.find(a => a.group_id === groupId)
    if (existing) {
      await client.delete(`/tests/${testId}/assignments/${existing.id}`)
      setAssignments(a => a.filter(x => x.id !== existing.id))
    } else {
      const dates = assignDates[groupId]
      const { data } = await client.post<TestAssignment>(`/tests/${testId}/assign`, {
        test_id: testId,
        group_id: groupId,
        available_from: dates?.from || null,
        available_to: dates?.to || null,
      })
      setAssignments(a => [...a, data])
    }
  }

  if (loading || !test) return <Spinner />

  const subjectName = subjects.find(s => s.id === test.subject_id)?.name ?? '—'
  const totalScore = questions.reduce((s, q) => s + q.score_max, 0)

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button onClick={() => navigate('/tests')} className="mt-1 text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-slate-800 truncate">{test.title}</h1>
            <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[test.status]}`}>
              {STATUS_LABEL[test.status]}
            </span>
          </div>
          <p className="text-sm text-slate-400">{subjectName} · {questions.length} вопросов · {totalScore.toFixed(1)} баллов</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {STATUS_ACTIONS.map(a => a.value !== test.status && (
            <button key={a.value} onClick={() => setStatus(a.value)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${a.cls}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(['settings', 'questions', 'assign'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t === 'settings' ? 'Настройки' : t === 'questions' ? `Вопросы (${questions.length})` : 'Назначение'}
          </button>
        ))}
      </div>

      {/* ── Settings tab ── */}
      {tab === 'settings' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Название</label>
            <input value={form.title ?? ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Описание</label>
            <textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Лимит времени (мин)</label>
              <input type="number" min={1} value={form.time_limit_minutes ?? ''}
                onChange={e => setForm(f => ({ ...f, time_limit_minutes: e.target.value ? Number(e.target.value) : null }))}
                placeholder="Без ограничений"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Попыток</label>
              <input type="number" min={1} max={99} value={form.attempts_allowed ?? 1}
                onChange={e => setForm(f => ({ ...f, attempts_allowed: Number(e.target.value) }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Порог сдачи (%)</label>
              <input type="number" min={0} max={100} value={form.passing_score_pct ?? 60}
                onChange={e => setForm(f => ({ ...f, passing_score_pct: Number(e.target.value) }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Доступен с</label>
              <input type="datetime-local" value={form.available_from?.slice(0, 16) ?? ''}
                onChange={e => setForm(f => ({ ...f, available_from: e.target.value || null }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Доступен до</label>
              <input type="datetime-local" value={form.available_to?.slice(0, 16) ?? ''}
                onChange={e => setForm(f => ({ ...f, available_to: e.target.value || null }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-6">
            {[
              { key: 'shuffle_questions', label: 'Перемешивать вопросы' },
              { key: 'shuffle_options', label: 'Перемешивать варианты' },
              { key: 'show_results', label: 'Показывать результаты' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={!!(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                  className="accent-blue-600" />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <button onClick={saveSettings} disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Сохранение...' : 'Сохранить настройки'}
            </button>
          </div>
        </div>
      )}

      {/* ── Questions tab ── */}
      {tab === 'questions' && (
        <div className="space-y-3">
          {questions.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">
              Вопросов пока нет
            </div>
          )}
          {questions.map((q, i) => (
            <div key={q.tq_id} className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4 flex items-start gap-4">
              {/* Order */}
              <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                <button onClick={() => moveQuestion(q, -1)} disabled={i === 0}
                  className="text-slate-300 hover:text-slate-600 disabled:opacity-20 text-xs">▲</button>
                <span className="text-sm font-semibold text-slate-400 w-5 text-center">{i + 1}</span>
                <button onClick={() => moveQuestion(q, 1)} disabled={i === questions.length - 1}
                  className="text-slate-300 hover:text-slate-600 disabled:opacity-20 text-xs">▼</button>
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                    {QTYPE_LABEL[q.question_type] ?? q.question_type}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${DIFF_BADGE[q.difficulty]}`}>
                    {q.difficulty}
                  </span>
                  <span className="text-xs text-slate-400">{q.score_max} б.</span>
                </div>
                {q.image_url && <img src={q.image_url} alt="" className="h-12 rounded mb-1 object-cover" />}
                <p className="text-sm text-slate-700 line-clamp-2">{q.body}</p>
              </div>
              {/* Actions */}
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setModal(q)}
                  className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                  Изменить
                </button>
                <button onClick={() => deleteQuestion(q)}
                  className="text-sm px-3 py-1.5 border border-red-100 rounded-lg hover:bg-red-50 text-red-500">
                  Удалить
                </button>
              </div>
            </div>
          ))}
          <button onClick={() => setModal('new')}
            className="w-full py-3 border-2 border-dashed border-blue-200 rounded-xl text-sm text-blue-500 hover:border-blue-400 hover:bg-blue-50 transition-colors">
            + Добавить вопрос
          </button>
        </div>
      )}

      {/* ── Assign tab ── */}
      {tab === 'assign' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="text-sm text-slate-500">Выберите группы, которым доступен тест. Даты переопределяют глобальные настройки.</p>
          </div>
          <div className="divide-y divide-slate-50">
            {groups.map(g => {
              const isAssigned = assignedGroupIds.has(g.id)
              return (
                <div key={g.id} className="px-6 py-4 flex items-center gap-4">
                  <input type="checkbox" checked={isAssigned}
                    onChange={() => toggleAssign(g.id)}
                    className="accent-blue-600 w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium text-slate-800 w-32 shrink-0">{g.name}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <input type="datetime-local"
                      value={assignDates[g.id]?.from ?? ''}
                      onChange={e => setAssignDates(d => ({ ...d, [g.id]: { ...d[g.id], from: e.target.value } }))}
                      className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <span className="text-slate-400 text-xs">—</span>
                    <input type="datetime-local"
                      value={assignDates[g.id]?.to ?? ''}
                      onChange={e => setAssignDates(d => ({ ...d, [g.id]: { ...d[g.id], to: e.target.value } }))}
                      className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  {isAssigned && <span className="text-xs text-emerald-600 shrink-0">Выдан</span>}
                </div>
              )
            })}
          </div>
        </div>
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
    </div>
  )
}

function Spinner() {
  return <div className="p-8 flex items-center gap-3 text-slate-400"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />Загрузка...</div>
}
