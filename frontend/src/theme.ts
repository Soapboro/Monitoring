import { createTheme, alpha } from '@mui/material/styles'

export const PEACH = {
  50:  '#FFF5F0',
  100: '#FFE8DC',
  200: '#FFCFBA',
  300: '#FFB096',
  400: '#F78C6C',
  500: '#E8724E',   // primary
  600: '#D45A38',   // hover
  700: '#B84628',
  800: '#923618',
  900: '#6B250D',
}

export const CREAM = {
  bg:      '#FDF8F5',   // page background
  sidebar: '#FFF5F0',   // sidebar background
  border:  '#EFE0D8',   // borders
  card:    '#FFFFFF',
}

export const WARM = {
  900: '#2E1A10',
  800: '#3D2416',
  700: '#5A3826',
  600: '#7A5244',
  500: '#9A6E62',
  400: '#BA9488',
  300: '#D4B8B0',
  200: '#EAD8D2',
  100: '#F5EDEA',
}

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main:        PEACH[500],
      light:       PEACH[300],
      dark:        PEACH[700],
      contrastText: '#FFFFFF',
    },
    secondary: {
      main:        PEACH[200],
      contrastText: PEACH[800],
    },
    background: {
      default: CREAM.bg,
      paper:   CREAM.card,
    },
    text: {
      primary:   WARM[800],
      secondary: WARM[500],
      disabled:  WARM[300],
    },
    divider: CREAM.border,
    error: {
      main:  '#D05050',
      light: '#F4D0CC',
    },
    success: {
      main:  '#4A9B72',
      light: '#D4EDDF',
    },
    warning: {
      main:  '#C9874A',
      light: '#F5E2CE',
    },
    grey: {
      50:  CREAM.bg,
      100: WARM[100],
      200: WARM[200],
      300: WARM[300],
      400: WARM[400],
      500: WARM[500],
      600: WARM[600],
      700: WARM[700],
      800: WARM[800],
      900: WARM[900],
    },
  },

  typography: {
    fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },

  shape: { borderRadius: 10 },

  shadows: [
    'none',
    '0 1px 4px rgba(62,36,22,.06)',
    '0 2px 8px rgba(62,36,22,.08)',
    '0 4px 16px rgba(62,36,22,.09)',
    '0 6px 24px rgba(62,36,22,.10)',
    '0 8px 32px rgba(62,36,22,.11)',
    ...Array(19).fill('none'),
  ] as any,

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: CREAM.bg,
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        },
        '*::-webkit-scrollbar': { width: 5, height: 5 },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
        '*::-webkit-scrollbar-thumb': { background: WARM[200], borderRadius: 99 },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 9,
          padding: '8px 18px',
          fontSize: 13.5,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        contained: {
          background: `linear-gradient(135deg, ${PEACH[400]} 0%, ${PEACH[600]} 100%)`,
          '&:hover': {
            background: `linear-gradient(135deg, ${PEACH[500]} 0%, ${PEACH[700]} 100%)`,
          },
        },
        outlined: {
          borderColor: CREAM.border,
          color: WARM[700],
          '&:hover': { borderColor: PEACH[300], background: PEACH[50] },
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${CREAM.border}`,
        },
        elevation1: { boxShadow: '0 2px 12px rgba(62,36,22,.07)' },
        elevation2: { boxShadow: '0 4px 20px rgba(62,36,22,.09)' },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${CREAM.border}`,
          boxShadow: '0 2px 12px rgba(62,36,22,.07)',
          borderRadius: 14,
        },
      },
    },

    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            background: CREAM.bg,
            color: WARM[500],
            fontWeight: 600,
            fontSize: 12.5,
            letterSpacing: .3,
            borderBottom: `1.5px solid ${CREAM.border}`,
          },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${CREAM.border}`,
          fontSize: 13.5,
          padding: '10px 16px',
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { background: alpha(PEACH[50], .7) },
          '&:last-child td': { borderBottom: 0 },
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          background: '#FDFAF8',
          '& fieldset': { borderColor: CREAM.border },
          '&:hover fieldset': { borderColor: PEACH[300] },
          '&.Mui-focused fieldset': { borderColor: PEACH[500] },
        },
        input: { fontSize: 14 },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: 13.5,
          color: WARM[600],
          '&.Mui-focused': { color: PEACH[600] },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 7, fontWeight: 500, fontSize: 12 },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, fontSize: 13.5 },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 18, border: 'none' },
      },
    },

    MuiDialogTitle: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: 16 },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontSize: 13.5,
          fontWeight: 500,
          minHeight: 44,
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        indicator: { height: 2, borderRadius: 2, background: PEACH[500] },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 9,
          margin: '1px 0',
          '&.Mui-selected': {
            background: alpha(PEACH[500], .12),
            color: PEACH[700],
            '&:hover': { background: alpha(PEACH[500], .16) },
          },
          '&:hover': { background: alpha(PEACH[500], .07) },
        },
      },
    },
  },
})
