import { TableCell, TableSortLabel } from '@mui/material'
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

export default function SortableHeader({ label, sortKey, currentKey, dir, onSort, align = 'left' }: Props) {
  const isActive = currentKey === sortKey
  return (
    <TableCell align={align} sortDirection={isActive ? dir : false}>
      <TableSortLabel
        active={isActive}
        direction={isActive ? dir : 'asc'}
        onClick={() => onSort(sortKey)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  )
}
