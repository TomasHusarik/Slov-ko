import { useCallback, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import CssBaseline from '@mui/material/CssBaseline'
import useMediaQuery from '@mui/material/useMediaQuery'
import { ThemeProvider, type PaletteMode } from '@mui/material/styles'
import { isCefrLevel, type CefrLevel, type WordPair } from './types'
import { createAppTheme } from './theme'
import { usePersistentState } from './hooks/usePersistentState'
import { useVocabulary } from './hooks/useVocabulary'
import { clearSession } from './session/session'
import type { Accent } from './services/dictionaryService'
import { PronunciationProvider } from './audio/PronunciationProvider'
import type { PronunciationSettings } from './audio/pronunciationContext'
import type { MistakeHistory } from './session/history'
import { AppHeader } from './components/AppHeader'
import { LevelDrawer } from './components/LevelDrawer'
import { SessionView } from './components/SessionView'

interface Preferences {
  level: CefrLevel
  mode: PaletteMode | 'system'
  sound: boolean
  /** Automatically pronounce the Czech word and the English answer. */
  speech: boolean
  /** Preferred accent of English recordings. */
  accent: Accent
  dictionary: boolean
  sessionSize: number
}

const DEFAULT_PREFERENCES: Preferences = {
  level: 'A1',
  mode: 'system',
  sound: true,
  speech: true,
  accent: 'uk',
  dictionary: true,
  sessionSize: 10,
}

export default function App() {
  const [storedPrefs, setPrefs] = usePersistentState<Preferences>('prefs', DEFAULT_PREFERENCES)
  const prefs: Preferences = {
    ...DEFAULT_PREFERENCES,
    ...storedPrefs,
    level: isCefrLevel(storedPrefs.level) ? storedPrefs.level : DEFAULT_PREFERENCES.level,
  }
  const [history, setHistory] = usePersistentState<MistakeHistory>('history', {})
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Bumping this remounts SessionView, which starts a fresh session.
  const [sessionNonce, setSessionNonce] = useState(0)

  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const mode: PaletteMode = prefs.mode === 'system' ? (prefersDark ? 'dark' : 'light') : prefs.mode
  const theme = useMemo(() => createAppTheme(mode), [mode])

  const { speech, accent, dictionary } = prefs
  const pronunciation = useMemo<PronunciationSettings>(
    () => ({ auto: speech, accent, dictionary }),
    [speech, accent, dictionary],
  )

  const vocabulary = useVocabulary(prefs.level)
  const updatePrefs = (patch: Partial<Preferences>) => setPrefs((prev) => ({ ...prev, ...patch }))

  const restart = useCallback(() => {
    clearSession(prefs.level)
    setSessionNonce((n) => n + 1)
  }, [prefs.level])

  const recordResult = useCallback(
    (word: WordPair, correct: boolean) =>
      setHistory((prev) => {
        const entry = prev[word.id] ?? { level: word.level, cs: word.cs, en: word.en[0], hits: 0, misses: 0 }
        return {
          ...prev,
          [word.id]: correct
            ? { ...entry, hits: entry.hits + 1 }
            : { ...entry, misses: entry.misses + 1, lastMissedAt: Date.now() },
        }
      }),
    [setHistory],
  )

  return (
    <ThemeProvider theme={theme}>
      <PronunciationProvider settings={pronunciation}>
        <CssBaseline />
        <AppHeader
          level={prefs.level}
          mode={mode}
          soundOn={prefs.sound}
          speechOn={prefs.speech}
          onOpenLevels={() => setDrawerOpen(true)}
          onToggleMode={() => updatePrefs({ mode: mode === 'dark' ? 'light' : 'dark' })}
          onToggleSound={() => updatePrefs({ sound: !prefs.sound })}
          onToggleSpeech={() => {
            updatePrefs({ speech: !prefs.speech })
          }}
        />
        <LevelDrawer
          open={drawerOpen}
          level={prefs.level}
          history={history}
          source={vocabulary.status === 'ready' ? vocabulary.data.source : null}
          onClose={() => setDrawerOpen(false)}
          onSelectLevel={(level) => updatePrefs({ level })}
          onRestart={restart}
          onClearHistory={() => setHistory({})}
          onPronunciationChange={(patch) => updatePrefs(patch)}
        />
        <Container component="main" maxWidth="sm" sx={{ py: { xs: 3, sm: 5 } }}>
          {vocabulary.status === 'loading' && (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
              <CircularProgress aria-label="Loading vocabulary" />
            </Box>
          )}
          {vocabulary.status === 'error' && (
            <Alert severity="error">Couldn’t load vocabulary for {prefs.level}: {vocabulary.error}</Alert>
          )}
          {vocabulary.status === 'ready' && (
            <SessionView
              key={`${prefs.level}-${sessionNonce}`}
              level={prefs.level}
              words={vocabulary.data.words}
              history={history}
              sessionSize={prefs.sessionSize}
              soundOn={prefs.sound}
              onSessionSizeChange={(sessionSize) => updatePrefs({ sessionSize })}
              onResult={recordResult}
              onRestart={restart}
              onChangeLevel={(level) => updatePrefs({ level })}
            />
          )}
        </Container>
      </PronunciationProvider>
    </ThemeProvider>
  )
}
