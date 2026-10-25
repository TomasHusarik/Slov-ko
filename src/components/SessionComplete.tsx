import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'
import { CEFR_LEVELS, type CefrLevel, type WordPair } from '../types'
import type { SessionState } from '../session/session'

interface SessionCompleteProps {
  state: SessionState
  wordMap: ReadonlyMap<string, WordPair>
  onRestart: () => void
  onChangeLevel: (level: CefrLevel) => void
}

export function SessionComplete({ state, wordMap, onRestart, onChangeLevel }: SessionCompleteProps) {
  const { stats } = state
  const accuracy = stats.attempts ? Math.round((stats.correct / stats.attempts) * 100) : 0
  const nextLevel = CEFR_LEVELS[CEFR_LEVELS.indexOf(state.level) + 1]
  const missed = state.missed.map((id) => wordMap.get(id)).filter((w): w is WordPair => Boolean(w))

  const summary = [
    { label: 'Words mastered', value: state.mastered.length },
    { label: 'Accuracy', value: `${accuracy}%` },
    { label: 'Best streak', value: stats.bestStreak },
    { label: 'Score', value: stats.score },
    { label: 'Hints used', value: stats.hintsUsed },
    { label: 'Skipped', value: stats.skips },
  ]

  return (
    <Card>
      <CardContent sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
        <EmojiEventsRoundedIcon sx={{ fontSize: 64, color: 'secondary.main' }} />
        <Typography variant="h5" component="h2" gutterBottom>
          Session complete!
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {accuracy >= 90
            ? 'Výborně! Excellent work.'
            : accuracy >= 70
              ? 'Dobře! Solid progress — keep going.'
              : 'Every mistake is a word you’ll remember next time.'}
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
          {summary.map(({ label, value }) => (
            <Box key={label}>
              <Typography variant="h5" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
            </Box>
          ))}
        </Box>

        {missed.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="overline" color="text.secondary">
              Worth another look
            </Typography>
            <Stack direction="row" useFlexGap sx={{ mt: 1, flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
              {missed.map((w) => (
                <Chip key={w.id} variant="outlined" label={`${w.cs} → ${w.en[0]}`} />
              ))}
            </Stack>
          </Box>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'center' }}>
          <Button variant="contained" size="large" startIcon={<ReplayRoundedIcon />} onClick={onRestart} autoFocus>
            New session
          </Button>
          {nextLevel && (
            <Button variant="outlined" size="large" endIcon={<ArrowForwardRoundedIcon />} onClick={() => onChangeLevel(nextLevel)}>
              Try {nextLevel}
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}
