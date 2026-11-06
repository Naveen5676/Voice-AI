import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: { main: '#b3422b', dark: '#91331f', contrastText: '#fff' },
    background: { default: '#f7f6f2', paper: '#fff' },
    text: { primary: '#222720', secondary: '#6e746b' },
    divider: '#e4e5de',
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Segoe UI", Inter, system-ui, sans-serif',
    h1: { fontWeight: 650, letterSpacing: '-0.055em' },
    h4: { fontWeight: 650, letterSpacing: '-0.035em' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { minHeight: 46 } } },
    MuiTextField: { defaultProps: { fullWidth: true, variant: 'outlined' } },
    MuiOutlinedInput: { styleOverrides: { root: { backgroundColor: '#fff' } } },
    MuiLink: { defaultProps: { underline: 'hover' } },
  },
})
