import { NavLink, useNavigate } from 'react-router-dom'
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Avatar, Typography, Divider, Tooltip,
} from '@mui/material'
import {
  HomeRounded, CalendarMonthRounded, PeopleRounded, SchoolRounded,
  PersonRounded, GroupsRounded, ApartmentRounded, MenuBookRounded,
  GradeRounded, EventAvailableRounded, QuizRounded, BarChartRounded,
  BoltRounded, LogoutRounded, DownloadRounded,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { useAuthStore } from '../store/authStore'
import { PEACH, CREAM, WARM } from '../theme'

const SIDEBAR_W = 228

interface NavItem { to: string; label: string; icon: React.ReactElement }

const ROLE_NAV: Record<string, NavItem[]> = {
  admin: [
    { to: '/dashboard',   label: 'Главная',       icon: <HomeRounded fontSize="small" /> },
    { to: '/schedule',    label: 'Расписание',     icon: <CalendarMonthRounded fontSize="small" /> },
    { to: '/users',       label: 'Пользователи',   icon: <PeopleRounded fontSize="small" /> },
    { to: '/students',    label: 'Студенты',       icon: <SchoolRounded fontSize="small" /> },
    { to: '/teachers',    label: 'Преподаватели',  icon: <PersonRounded fontSize="small" /> },
    { to: '/groups',      label: 'Группы',         icon: <GroupsRounded fontSize="small" /> },
    { to: '/departments', label: 'Кафедры',        icon: <ApartmentRounded fontSize="small" /> },
    { to: '/subjects',    label: 'Предметы',       icon: <MenuBookRounded fontSize="small" /> },
  ],
  teacher: [
    { to: '/dashboard',  label: 'Главная',       icon: <HomeRounded fontSize="small" /> },
    { to: '/lessons',    label: 'Занятия',       icon: <CalendarMonthRounded fontSize="small" /> },
    { to: '/grades',     label: 'Оценки',        icon: <GradeRounded fontSize="small" /> },
    { to: '/attendance', label: 'Посещаемость',  icon: <EventAvailableRounded fontSize="small" /> },
    { to: '/tests',      label: 'Тесты',         icon: <QuizRounded fontSize="small" /> },
    { to: '/analytics',      label: 'Аналитика',       icon: <BarChartRounded fontSize="small" /> },
    { to: '/test-analytics', label: 'Аналитика тестов', icon: <QuizRounded fontSize="small" /> },
    { to: '/reports',        label: 'Отчёты',          icon: <DownloadRounded fontSize="small" /> },
  ],
  student: [
    { to: '/dashboard',    label: 'Главная',       icon: <HomeRounded fontSize="small" /> },
    { to: '/my-grades',    label: 'Мои оценки',    icon: <GradeRounded fontSize="small" /> },
    { to: '/my-attendance',label: 'Посещаемость',  icon: <EventAvailableRounded fontSize="small" /> },
    { to: '/my-tests',     label: 'Тесты',         icon: <QuizRounded fontSize="small" /> },
    { to: '/my-adaptive',  label: 'Рекомендации',  icon: <BoltRounded fontSize="small" /> },
  ],
}

const ROLE_LABELS: Record<string, string> = {
  admin:   'Администратор',
  teacher: 'Преподаватель',
  student: 'Студент',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const user    = useAuthStore(s => s.user)
  const logout  = useAuthStore(s => s.logout)
  const navigate = useNavigate()

  const navItems  = ROLE_NAV[user?.role ?? 'student'] ?? []
  const roleLabel = user?.role ? ROLE_LABELS[user.role] : ''
  const initials  = (user?.email?.[0] ?? '?').toUpperCase()

  function handleLogout() { logout(); navigate('/login') }

  const sidebarContent = (
    <Box sx={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: CREAM.sidebar,
      borderRight: `1.5px solid ${CREAM.border}`,
    }}>
      {/* Logo */}
      <Box sx={{ px: 2.5, py: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 38, height: 38, borderRadius: '11px', flexShrink: 0,
            background: `linear-gradient(135deg, ${PEACH[400]} 0%, ${PEACH[600]} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 14px ${alpha(PEACH[600], .35)}`,
          }}>
            <BarChartRounded sx={{ color: 'white', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: WARM[800], lineHeight: 1.2 }}>
              Мониторинг
            </Typography>
            <Typography sx={{ fontSize: 11, color: WARM[400], lineHeight: 1.2 }}>
              успеваемости
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ borderColor: CREAM.border, mx: 1.5 }} />

      {/* Navigation */}
      <List sx={{ flex: 1, px: 1.5, py: 1.5, overflowY: 'auto' }}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            style={{ textDecoration: 'none' }}
          >
            {({ isActive }) => (
              <ListItemButton
                selected={isActive}
                sx={{
                  borderRadius: '10px',
                  mb: .5,
                  px: 1.5, py: .9,
                  minHeight: 40,
                  ...(isActive && {
                    background: `linear-gradient(135deg, ${alpha(PEACH[400], .15)} 0%, ${alpha(PEACH[600], .1)} 100%)`,
                    '&:hover': {
                      background: `linear-gradient(135deg, ${alpha(PEACH[400], .2)} 0%, ${alpha(PEACH[600], .15)} 100%)`,
                    },
                  }),
                }}
              >
                <ListItemIcon sx={{
                  minWidth: 32,
                  color: isActive ? PEACH[600] : WARM[400],
                }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  slotProps={{
                    primary: {
                      fontSize: 13.5,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? PEACH[700] : WARM[700],
                    },
                  }}
                />
                {isActive && (
                  <Box sx={{
                    width: 3, height: 20, borderRadius: 2,
                    background: `linear-gradient(180deg, ${PEACH[400]}, ${PEACH[600]})`,
                    flexShrink: 0,
                  }} />
                )}
              </ListItemButton>
            )}
          </NavLink>
        ))}
      </List>

      <Divider sx={{ borderColor: CREAM.border, mx: 1.5 }} />

      {/* User */}
      <Box sx={{ p: 1.5 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.2,
          px: 1.5, py: 1, mb: .5, borderRadius: '10px',
          background: alpha(PEACH[500], .06),
        }}>
          <Avatar sx={{
            width: 32, height: 32, fontSize: 13, fontWeight: 700,
            background: `linear-gradient(135deg, ${PEACH[300]}, ${PEACH[600]})`,
            color: 'white',
          }}>
            {initials}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: WARM[800], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </Typography>
            <Typography sx={{ fontSize: 11, color: WARM[400] }}>
              {roleLabel}
            </Typography>
          </Box>
        </Box>

        <Tooltip title="Выйти" placement="right">
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: '10px', px: 1.5, py: .9,
              color: WARM[500],
              '&:hover': { background: alpha('#D05050', .08), color: '#D05050' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
              <LogoutRounded fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Выйти"
              slotProps={{ primary: { fontSize: 13.5, fontWeight: 400 } }}
            />
          </ListItemButton>
        </Tooltip>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: CREAM.bg }}>
      <Drawer
        variant="permanent"
        sx={{
          width: SIDEBAR_W,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: SIDEBAR_W,
            boxSizing: 'border-box',
            border: 'none',
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      <Box component="main" sx={{ flex: 1, overflow: 'auto', minHeight: '100vh' }}>
        {children}
      </Box>
    </Box>
  )
}
