import { useState, type FormEvent } from 'react'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import type { CefrLevel } from '../types'
import { LEVEL_INFO } from '../data/levels'

const PRESETS = [10, 20, 50, 100]

interface SessionSetupProps {
  level: CefrLevel
  available: number
  /** How many of the available words come from the hand-curated list (the rest are from Wiktionary). */
  curated: number
  initialSize: number
  troubleCount: number
  onStart: (size: number) => void
}

/** Asks how many words to practise: quick presets plus a free number input. */
export function SessionSetup({ level, available, curated, initialSize, troubleCount, onStart }: SessionSetupProps) {
  const [value, setValue] = useState(() => String(initialSize > 0 ? Math.min(initialSize, available) : available))
  const size = Number(value)
  const valid = value.trim() !== '' && Number.isInteger(size) && size >= 1 && size <= available
  const presets = PRESETS.filter((p) => p < available)
  const info = LEVEL_INFO[level]

  const start = (event: FormEvent) => {
    event.preventDefault()
    if (valid) onStart(size)
  }

  return (
    <Card>
      <CardContent component="form" onSubmit={start} noValidate sx={{ p: { xs: 3, sm: 5 }, '&:last-child': { pb: { xs: 3, sm: 5 } } }}>
        <Stack spacing={3}>
          <Stack spacing={0.5} sx={{ textAlign: 'center' }}>
            <Typography variant="overline" color="text.secondary">
              New session · {level} {info.title}
            </Typography>
            <Typography variant="h5" component="h2">
              How many words do you want to practise?
            </Typography>
          </Stack>

          <ToggleButtonGroup
            exclusive
            fullWidth
            color="primary"
            aria-label="Quick pick word count"
            value={valid ? size : null}
            onChange={(_, picked: number | null) => picked !== null && setValue(String(picked))}
          >
            {presets.map((p) => (
              <ToggleButton key={p} value={p} sx={{ fontWeight: 700 }}>
                {p}
              </ToggleButton>
            ))}
            <ToggleButton value={available} sx={{ fontWeight: 700 }}>
              All
            </ToggleButton>
          </ToggleButtonGroup>

          <TextField
            label="Or enter your own number"
            type="number"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.target.select()}
            error={!valid}
            helperText={
              valid
                ? `${available.toLocaleString('en')} words in ${level}: ${curated} curated + ${(available - curated).toLocaleString('en')} from Wiktionary. Common words come first.`
                : `Enter a whole number from 1 to ${available.toLocaleString('en')}`
            }
            slotProps={{ htmlInput: { min: 1, max: available, step: 1, inputMode: 'numeric' } }}
          />

          {troubleCount > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              Up to half the session will be words you’ve missed before ({troubleCount} in this level).
            </Typography>
          )}

          <Button type="submit" variant="contained" size="large" startIcon={<PlayArrowRoundedIcon />} disabled={!valid}>
            Start {valid ? `${size} word${size === 1 ? '' : 's'}` : 'session'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}
