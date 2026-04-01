import { useEffect, useState } from 'react'
import { getMyGrades } from '../../api/resources'
import type { GradeOut } from '../../api/resources'

const GRADE_TYPE_LABELS: Record<string, string> = {
  current: 'Текущая',
  midterm: 'Промежуточная',
  final: 'Итоговая',
  test: 'Тест',
}

export default function MyGradesPage() {
  const [grades, setGrades] = useState<GradeOut[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyGrades().then(setGrades).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">Мои оценки</h1>
      <p className="text-slate-400 text-sm mb-6">Все выставленные оценки по дисциплинам</p>

      {grades.length === 0 ? (
        <Empty text="Оценок пока нет" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Дата</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Тип</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Оценка</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Зачёт</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {grades.map(g => (
                <tr key={g.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-500">{g.date_recorded.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {GRADE_TYPE_LABELS[g.grade_type] ?? g.grade_type}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {g.value !== null ? (
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        g.value >= 4 ? 'bg-emerald-100 text-emerald-700' :
                        g.value >= 3 ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {g.value}
                      </span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {g.passed === true && <span className="text-emerald-600 text-xs font-medium">Сдано</span>}
                    {g.passed === false && <span className="text-red-500 text-xs font-medium">Не сдано</span>}
                    {g.passed === null && <span className="text-slate-400 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

function Empty({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">
      {text}
    </div>
  )
}
