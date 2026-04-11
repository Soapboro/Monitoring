import type { SortDir } from '../hooks/useSort'

interface Props {
  label: string
  sortKey: string
  currentKey: string | null
  dir: SortDir
  onSort: (key: string) => void
  align?: 'left' | 'right' | 'center'
  className?: string
}

export default function SortableHeader({ label, sortKey, currentKey, dir, onSort, align = 'left', className = '' }: Props) {
  const isActive = currentKey === sortKey
  const base = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
  return (
    <th
      className={`px-4 py-3 text-slate-500 font-medium cursor-pointer select-none hover:text-slate-700 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className={`flex items-center gap-1 ${base}`}>
        {label}
        <SortIcon active={isActive} dir={dir} />
      </span>
    </th>
  )
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`inline-flex flex-col gap-px transition-opacity ${active ? 'opacity-100' : 'opacity-30'}`}>
      <svg
        className={`w-2.5 h-2.5 ${active && dir === 'asc' ? 'text-blue-600' : 'text-slate-400'}`}
        viewBox="0 0 10 6" fill="currentColor"
      >
        <path d="M5 0L10 6H0L5 0Z" />
      </svg>
      <svg
        className={`w-2.5 h-2.5 ${active && dir === 'desc' ? 'text-blue-600' : 'text-slate-400'}`}
        viewBox="0 0 10 6" fill="currentColor"
      >
        <path d="M5 6L0 0H10L5 6Z" />
      </svg>
    </span>
  )
}
