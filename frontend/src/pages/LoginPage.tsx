import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, TextField, Button, Alert, InputAdornment, IconButton,
} from '@mui/material'
import { BarChartRounded, Visibility, VisibilityOff } from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { useAuthStore } from '../store/authStore'
import { PEACH, WARM } from '../theme'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const login    = useAuthStore(s => s.login)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Ошибка входа. Проверьте данные.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      background: `radial-gradient(ellipse at 70% 20%, ${alpha(PEACH[200], .5)} 0%, transparent 60%),
                   radial-gradient(ellipse at 20% 80%, ${alpha(PEACH[100], .6)} 0%, transparent 55%),
                   #fdf8f5`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      px: 2,
    }}>
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        {/* Лого */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 60, height: 60, borderRadius: '16px', mb: 2,
            background: `linear-gradient(135deg, ${PEACH[400]} 0%, ${PEACH[600]} 100%)`,
            boxShadow: `0 8px 28px ${alpha(PEACH[600], .35)}`,
          }}>
            <BarChartRounded sx={{ color: 'white', fontSize: 30 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: WARM[800] }}>
            Мониторинг успеваемости
          </Typography>
          <Typography variant="body2" sx={{ color: WARM[500], mt: .5 }}>
            Войдите в систему
          </Typography>
        </Box>

        {/* Карточка */}
        <Paper elevation={2} sx={{
          p: '32px 32px 28px',
          borderRadius: '20px',
          border: `1.5px solid ${alpha(PEACH[200], .6)}`,
          boxShadow: `0 8px 40px ${alpha(WARM[800], .08)}`,
        }}>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="Email"
              type="email"
              required
              fullWidth
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@mail.ru"
              size="small"
            />

            <TextField
              label="Пароль"
              type={showPwd ? 'text' : 'password'}
              required
              fullWidth
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              size="small"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPwd(v => !v)} edge="end" tabIndex={-1}>
                        {showPwd
                          ? <VisibilityOff fontSize="small" sx={{ color: WARM[400] }} />
                          : <Visibility fontSize="small" sx={{ color: WARM[400] }} />
                        }
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {error && (
              <Alert severity="error" sx={{ py: .5 }}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              size="large"
              sx={{
                mt: .5,
                py: 1.3,
                fontSize: 15,
                borderRadius: '11px',
                background: `linear-gradient(135deg, ${PEACH[400]} 0%, ${PEACH[600]} 100%)`,
                boxShadow: `0 4px 16px ${alpha(PEACH[600], .4)}`,
                '&:hover': {
                  background: `linear-gradient(135deg, ${PEACH[500]} 0%, ${PEACH[700]} 100%)`,
                  boxShadow: `0 6px 20px ${alpha(PEACH[600], .5)}`,
                },
                '&:disabled': { background: alpha(PEACH[300], .6), boxShadow: 'none' },
              }}
            >
              {loading ? 'Вход...' : 'Войти'}
            </Button>
          </Box>
        </Paper>

        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 3, color: WARM[400] }}>
          Отслеживайте свои успехи или контролируйте процесс обучения!
        </Typography>
      </Box>
    </Box>
  )
}
