import { useState, useMemo } from 'react'

export type SortDir = 'asc' | 'desc'

export function useSort<T>(
  items: T[],
  getValue: (item: T, key: string) => string | number | boolean | null | undefined,
) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return items
    return [...items].sort((a, b) => {
      const av = getValue(a, sortKey) ?? ''
      const bv = getValue(b, sortKey) ?? ''
      let cmp = 0
      if (typeof av === 'boolean' && typeof bv === 'boolean') {
        cmp = Number(av) - Number(bv)
      } else if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv
      } else {
        cmp = String(av).localeCompare(String(bv), 'ru', { numeric: true })
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [items, sortKey, sortDir])

  return { sorted, sortKey, sortDir, toggleSort }
}
