import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { keyframes } from '@mui/material/styles'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import KeyboardReturnRoundedIcon from '@mui/icons-material/KeyboardReturnRounded'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded'
import SpellcheckRoundedIcon from '@mui/icons-material/SpellcheckRounded'
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded'
import type { WordPair } from '../types'
import type { Outcome, Phase } from '../session/session'
import { usePronunciation } from '../audio/pronunciationContext'
import { countLetters, normalizeAnswer } from '../utils/text'
import { answerToSpeak } from '../utils/answerToSpeak'
import { DictionaryPanel } from './DictionaryPanel'
import { lookupRecordings } from '../services/dictionaryService'
import { useLookup } from '../hooks/useLookup'
import { HintMask } from './HintMask'

const shake = keyframes`
  10%, 90% { transform: translateX(-2px); }
  20%, 80% { transform: translateX(4px); }
  30%, 50%, 70% { transform: translateX(-8px); }
  40%, 60% { transform: translateX(8px); }
`

const wobble = keyframes`
  25% { transform: rotate(-0.6deg); }
  75% { transform: rotate(0.6deg); }
`

const pop = keyframes`
  0% { transform: scale(1); }
  40% { transform: scale(1.025); }
  100% { transform: scale(1); }
`

const enter = keyframes`
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to { opacity: 1; transform: none; }
`

const OUTCOME_COLOR: Record<Outcome, 'success.main' | 'error.main' | 'warning.main'> = {
  correct: 'success.main',
  incorrect: 'error.main',
  skipped: 'warning.main',
}

interface FlashCardProps {
  word: WordPair
  phase: Phase
  outcome: Outcome | null
  lastAnswer: string
  lastPoints: number
  hintsRevealed: number
  isReview: boolean
  /** The near-miss typed on this card, if the learner is fixing a typo. */
  nearMiss: string | null
  acceptedVia?: 'list' | 'dictionary'
  /** An answer is being checked against the online dictionary. */
  checking: boolean
  onSubmit: (answer: string) => void
  onHint: (maxHints: number) => void
  onSkip: () => void
  onNext: () => void
}

export function FlashCard({
  word,
  phase,
  outcome,
  lastAnswer,
  lastPoints,
  hintsRevealed,
  isReview,
  nearMiss,
  acceptedVia,
  checking,
  onSubmit,
  onHint,
  onSkip,
  onNext,
}: FlashCardProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { settings, playEnglish } = usePronunciation()
  const answering = phase === 'answering'
  const primary = word.en[0]
  // Always leave at least one letter for the learner to produce.
  const maxHints = Math.max(1, countLetters(primary) - 1)
  const spokenAnswer = answerToSpeak(word, outcome, lastAnswer, acceptedVia)
  // English is only ever played from real recordings, so the button appears only when one exists.
  const recordings = useLookup(spokenAnswer, lookupRecordings)
  const hasRecording = recordings.status === 'done' && Boolean(recordings.value?.length)

  // Keep focus in the input so Enter always works, even after clicking Hint/Skip.
  useEffect(() => {
    if (!checking) inputRef.current?.focus()
  }, [phase, hintsRevealed, nearMiss, checking])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.repeat || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (checking) return
    if (answering) {
      if (value.trim()) onSubmit(value)
    } else {
      onNext()
    }
  }

  const englishSpeaker = (text: string) =>
    hasRecording ? (
      <Tooltip title="Play a native-speaker recording">
        <IconButton size="small" color="inherit" aria-label={`Play recording of ${text}`} onClick={() => playEnglish(text)}>
          <VolumeUpRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    ) : undefined

  const alternatives = word.en.filter((e) => normalizeAnswer(e) !== normalizeAnswer(lastAnswer))
  const correctTitle =
    acceptedVia === 'dictionary'
      ? `Correct — found in the dictionary · +${lastPoints}`
      : hintsRevealed > 0
        ? `Correct with hints · +${lastPoints}`
        : nearMiss
          ? `Correct after a spelling fix · +${lastPoints}`
          : `Correct! · +${lastPoints}`

  return (
    <Card
      sx={{
        position: 'relative',
        borderWidth: 2,
        borderColor: outcome ? OUTCOME_COLOR[outcome] : nearMiss ? 'info.main' : 'divider',
        transition: 'border-color 200ms, box-shadow 200ms',
        boxShadow: (t) =>
          outcome === 'correct'
            ? `0 0 0 6px ${t.palette.mode === 'dark' ? 'rgba(74,222,128,0.12)' : 'rgba(22,163,74,0.1)'}`
            : t.shadows[0],
        animation:
          outcome === 'incorrect'
            ? `${shake} 450ms ease-in-out`
            : outcome === 'correct'
              ? `${pop} 350ms ease-out`
              : nearMiss
                ? `${wobble} 300ms ease-in-out 2`
                : `${enter} 280ms ease-out`,
      }}
    >
      <CardContent sx={{ p: { xs: 3, sm: 5 }, '&:last-child': { pb: { xs: 3, sm: 5 } } }}>
        <Stack spacing={3}>
          <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="overline" color="text.secondary">
                Translate to English
              </Typography>
              {word.pos && <Chip size="small" variant="outlined" label={word.pos} />}
              {isReview && (
                <Chip size="small" color="warning" variant="outlined" icon={<ReplayRoundedIcon />} label="Review" />
              )}
            </Stack>
            <Typography variant="h3" component="p" lang="cs" sx={{ fontSize: { xs: '2.2rem', sm: '3rem' } }}>
              {word.cs}
            </Typography>
            <Box sx={{ minHeight: 40, display: 'grid', placeItems: 'center' }}>
              {(hintsRevealed > 0 || !answering) && (
                <HintMask answer={primary} revealed={hintsRevealed} full={!answering} />
              )}
            </Box>
          </Stack>

          <TextField
            inputRef={inputRef}
            fullWidth
            autoFocus
            value={answering ? value : lastAnswer || value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type the English word…"
            color={outcome === 'correct' ? 'success' : nearMiss && answering ? 'info' : 'primary'}
            error={outcome === 'incorrect'}
            focused={outcome === 'correct' || (answering && Boolean(nearMiss)) || undefined}
            slotProps={{
              htmlInput: {
                readOnly: !answering || checking,
                autoCapitalize: 'none',
                autoCorrect: 'off',
                autoComplete: 'off',
                spellCheck: false,
                lang: 'en',
                'aria-label': `English translation of ${word.cs}`,
                style: { fontSize: '1.25rem', textAlign: 'center' },
              },
              input: {
                endAdornment: checking ? (
                  <CircularProgress size={22} aria-label="Checking the dictionary" />
                ) : outcome === 'correct' ? (
                  <CheckCircleRoundedIcon color="success" />
                ) : outcome === 'incorrect' ? (
                  <CancelRoundedIcon color="error" />
                ) : undefined,
              },
            }}
          />

          <Collapse in={answering && Boolean(nearMiss)} unmountOnExit>
            <Alert severity="info" variant="outlined" icon={<SpellcheckRoundedIcon />} role="status">
              <AlertTitle>Almost!</AlertTitle>
              “{nearMiss?.trim()}” is very close — check the spelling and try once more.
            </Alert>
          </Collapse>

          <Collapse in={!answering} unmountOnExit>
            <Stack spacing={2}>
              {outcome === 'correct' && (
                <Alert severity="success" variant="outlined" role="status" action={englishSpeaker(spokenAnswer)}>
                  <AlertTitle sx={{ mb: alternatives.length ? 0.5 : 0 }}>{correctTitle}</AlertTitle>
                  {hintsRevealed > 0 && 'This word will come back once more without hints. '}
                  {alternatives.length > 0 &&
                    `${acceptedVia === 'dictionary' ? 'Words from our list' : 'Also accepted'}: ${alternatives.join(', ')}`}
                </Alert>
              )}
              {outcome === 'incorrect' && (
                <Alert severity="error" variant="outlined" role="status" action={englishSpeaker(primary)}>
                  <AlertTitle>
                    Answer: <strong>{word.en.join(', ')}</strong>
                  </AlertTitle>
                  You wrote “{lastAnswer.trim()}”. This word will come back later in the session.
                </Alert>
              )}
              {outcome === 'skipped' && (
                <Alert severity="warning" variant="outlined" role="status" action={englishSpeaker(primary)}>
                  <AlertTitle>
                    Answer: <strong>{word.en.join(', ')}</strong>
                  </AlertTitle>
                  Skipped — it’s been added to your retry queue.
                </Alert>
              )}
              {settings.dictionary && <DictionaryPanel cs={word.cs} en={spokenAnswer} />}
            </Stack>
          </Collapse>

          {answering ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Tooltip title={`Reveal a letter (−3 points) · ${maxHints - hintsRevealed} left`}>
                <span>
                  <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<LightbulbOutlinedIcon />}
                    onClick={() => onHint(maxHints)}
                    disabled={hintsRevealed >= maxHints || checking}
                  >
                    Hint
                  </Button>
                </span>
              </Tooltip>
              <Button
                color="inherit"
                startIcon={<SkipNextRoundedIcon />}
                onClick={onSkip}
                disabled={checking}
                sx={{ color: 'text.secondary' }}
              >
                Skip
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button
                variant="contained"
                size="large"
                endIcon={<KeyboardReturnRoundedIcon />}
                onClick={() => onSubmit(value)}
                disabled={!value.trim() || checking}
              >
                Check
              </Button>
            </Stack>
          ) : (
            <Button variant="contained" size="large" fullWidth endIcon={<KeyboardReturnRoundedIcon />} onClick={onNext}>
              Next
            </Button>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            Press <kbd>Enter</kbd> to {answering ? 'check' : 'continue'}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  )
}
