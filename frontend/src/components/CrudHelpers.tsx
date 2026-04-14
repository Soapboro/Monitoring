import type { ReactNode } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box,
} from '@mui/material'
import { EditRounded, DeleteRounded } from '@mui/icons-material'

export function Overlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <Box sx={{ p: 1 }}>{children}</Box>
    </Dialog>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5, display: 'block', fontSize: 12 }}>
        {label}
      </Typography>
      {children}
    </Box>
  )
}

export function ConfirmDelete({ text, onConfirm, onCancel }: {
  text: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <Dialog open onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 600 }}>Подтвердите удаление</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">{text}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onCancel} variant="outlined" size="small">Отмена</Button>
        <Button onClick={onConfirm} variant="contained" size="small"
          sx={{ bgcolor: '#D05050', '&:hover': { bgcolor: '#B03838' } }}>
          Удалить
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function PencilIcon() {
  return <EditRounded sx={{ fontSize: 16 }} />
}

export function TrashIcon() {
  return <DeleteRounded sx={{ fontSize: 16 }} />
}
