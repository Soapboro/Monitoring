import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts'
import {
  getMyStudentProfile, getMyGrades, getMySessions, getMyAttendance,
} from '../../api/resources'
import type { StudentProfile, GradeOut, TestSession, AttendanceRecord } from '../../api/resources'
import { getStudentSubjects, getStudentProgress } from '../../api/analytics'
import type { StudentSubjectRow, StudentProgressRow } from '../../api/analytics'

export default function StudentDashboard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [grades, setGrades] = useState<GradeOut[]>([])
  const [sessions, setSessions] = useState<TestSession[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [subjectSummary, setSubjectSummary] = useState<StudentSubjectRow[]>([])
  const [progress, setProgress] = useState<StudentProgressRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const [prof, gr, sess, att] = await Promise.all([
          getMyStudentProfile(),
          getMyGrades(),
          getMySessions(),
          getMyAttendance(),
        ])
        setProfile(prof)
        setGrades(gr)
        setSessions(sess)
        setAttendance(att)

        const [subj, prog] = await Promise.all([
          getStudentSubjects(prof.id),
          getStudentProgress(prof.id),
        ])
        setSubjectSummary(subj)
        setProgress(prog)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  if (loading) return <Spinner />

  // Счётчики
  const completedSessions = sessions.filter(s => s.status === 'completed')
  const presentCount = attendance.filter(a => a.is_present).length
  const attendanceRate = attendance.length > 0
    ? Math.round(presentCount / attendance.length * 100)
    : null

  const avgGradeAll = grades.filter(g => g.value !== null).length > 0
    ? (grades.filter(g => g.value !== null).reduce((s, g) => s + (g.value ?? 0), 0) / grades.filter(g => g.value !== null).length).toFixed(2)
    : null

  // График по предметам
  const subjectChartData = subjectSummary.map(r => ({
    name: r.subject.length > 14 ? r.subject.slice(0, 12) + '…' : r.subject,
    fullName: r.subject,
    avg: Number(r.avg_grade),
  }))

  // График динамики — берём последние 30 точек, усредняем по неделям по дате
  const progressChartData = progress.slice(-30).map(r => ({
    date: r.date_recorded.slice(0, 10),
    value: r.value,
    subject: r.subject,
  }))

  // Уникальные предметы для линий прогресса
  const uniqueSubjects = [...new Set(progress.map(r => r.subject))].slice(0, 5)
  const SUBJECT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

  // Агрегируем прогресс по дате + предмету для LineChart
  const progressByDate: Record<string, Record<string, number>> = {}
  for (const r of progress) {
    const d = r.date_recorded.slice(0, 10)
    if (!progressByDate[d]) progressByDate[d] = {}
    progressByDate[d][r.subject] = r.value
  }
  const progressLineData = Object.entries(progressByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, ...vals }))

  const statCards = [
    {
      label: 'Средний балл',
      value: avgGradeAll ?? '—',
      sub: 'по всем предметам',
      color: 'bg-blue-500',
      to: '/my-grades',
    },
    {
      label: 'Всего оценок',
      value: grades.filter(g => g.value !== null).length,
      color: 'bg-green-500',
      to: '/my-grades',
    },
    {
      label: 'Тестов пройдено',
      value: completedSessions.length,
      color: 'bg-purple-500',
      to: '/my-tests',
    },
    {
      label: 'Посещаемость',
      value: attendanceRate !== null ? `${attendanceRate}%` : '—',
      sub: `${presentCount} из ${attendance.length} занятий`,
      color: 'bg-amber-500',
      to: '/my-attendance',
    },
  ]

  return (
    <div className="p-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Главная</h1>
        {profile && (
          <p className="text-slate-400 text-sm mt-1">
            {profile.last_name} {profile.first_name} {profile.middle_name ?? ''}
            {profile.student_num && ` · ${profile.student_num}`}
          </p>
        )}
      </div>

      {/* Счётчики — кликабельные */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map(card => (
          <button
            key={card.label}
            onClick={() => navigate(card.to)}
            className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-left
                       hover:shadow-md hover:border-slate-200 transition-all cursor-pointer"
          >
            <div className={`w-2 h-2 rounded-full ${card.color} mb-3`} />
            <p className="text-3xl font-bold text-slate-800">{card.value}</p>
            <p className="text-sm text-slate-500 mt-0.5">{card.label}</p>
            {card.sub && <p className="text-xs text-slate-400 mt-0.5">{card.sub}</p>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Средний балл по предметам */}
        {subjectChartData.length > 0 && (
          <div
            onClick={() => navigate('/my-grades')}
            className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm cursor-pointer hover:shadow-md hover:border-slate-200 transition-all"
          >
            <h2 className="text-base font-semibold text-slate-700 mb-1">Средний балл по предметам</h2>
            <p className="text-xs text-slate-400 mb-4">Все дисциплины</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={subjectChartData} margin={{ top: 0, right: 8, left: -16, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  formatter={(v: number) => [v.toFixed(2), 'Средний балл']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                  contentStyle={{ borderRadius: 8, fontSize: 11 }}
                />
                <Bar dataKey="avg" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Динамика оценок */}
        {progressLineData.length > 1 && (
          <div
            onClick={() => navigate('/my-grades')}
            className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm cursor-pointer hover:shadow-md hover:border-slate-200 transition-all"
          >
            <h2 className="text-base font-semibold text-slate-700 mb-1">Динамика оценок</h2>
            <p className="text-xs text-slate-400 mb-4">По дате выставления</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={progressLineData} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} />
                <YAxis domain={[1, 5]} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {uniqueSubjects.map((subj, i) => (
                  <Line
                    key={subj}
                    type="monotone"
                    dataKey={subj}
                    stroke={SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
                    dot={false}
                    strokeWidth={2}
                    connectNulls
                    name={subj.length > 20 ? subj.slice(0, 18) + '…' : subj}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Последние оценки */}
      {grades.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-700">Последние оценки</h2>
            <button
              onClick={() => navigate('/my-grades')}
              className="text-xs text-blue-600 hover:underline cursor-pointer"
            >
              Все оценки →
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Дата</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Тип</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Оценка</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {grades.slice(0, 8).map(g => (
                <tr key={g.id} onClick={() => navigate('/my-grades')} className="hover:bg-slate-50 cursor-pointer">
                  <td className="px-6 py-3 text-slate-500">{g.date_recorded.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{g.grade_type}</td>
                  <td className="px-6 py-3 text-right">
                    {g.value !== null ? (
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        g.value >= 4 ? 'bg-emerald-100 text-emerald-700' :
                        g.value >= 3 ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {g.value}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {grades.length === 0 && sessions.length === 0 && !loading && (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400 shadow-sm">
          Данных пока нет. Скоро здесь появится статистика.
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <div className="p-8 flex items-center gap-3 text-slate-400">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      Загрузка...
    </div>
  )
}
