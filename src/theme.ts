import { alpha, createTheme, type PaletteMode } from '@mui/material/styles'

export function createAppTheme(mode: PaletteMode) {
  const dark = mode === 'dark'
  const primary = dark ? '#8b9cff' : '#4f5bd5'

  return createTheme({
    palette: {
      mode,
      primary: { main: primary },
      secondary: { main: dark ? '#ffb86b' : '#f97316' },
      success: { main: dark ? '#4ade80' : '#16a34a' },
      error: { main: dark ? '#f87171' : '#dc2626' },
      warning: { main: dark ? '#fbbf24' : '#d97706' },
      background: {
        default: dark ? '#0f1220' : '#f5f6fb',
        paper: dark ? '#171b2e' : '#ffffff',
      },
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif',
      h3: { fontWeight: 800, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      button: { textTransform: 'none', fontWeight: 600 },
      overline: { fontWeight: 700, letterSpacing: '0.12em' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundImage: `radial-gradient(1200px 600px at 10% -10%, ${alpha(primary, dark ? 0.18 : 0.12)}, transparent),
              radial-gradient(900px 500px at 110% 10%, ${alpha('#f97316', dark ? 0.1 : 0.08)}, transparent)`,
            backgroundAttachment: 'fixed',
            minHeight: '100vh',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 12, paddingInline: 18 } },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: { root: { borderRadius: 24 } },
      },
      MuiTooltip: { defaultProps: { arrow: true } },
    },
  })
}
