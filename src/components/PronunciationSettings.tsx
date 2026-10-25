import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { usePronunciation, type PronunciationSettings as Settings } from '../audio/pronunciationContext'
import type { Accent } from '../services/dictionaryService'

export type PronunciationPatch = Partial<Pick<Settings, 'accent' | 'dictionary'>>

export function PronunciationSettings({ onChange }: { onChange: (patch: PronunciationPatch) => void }) {
  const { settings } = usePronunciation()

  return (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">
          English recordings — preferred accent
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          color="primary"
          value={settings.accent}
          onChange={(_, accent: Accent | null) => accent && onChange({ accent })}
        >
          <ToggleButton value="uk">British</ToggleButton>
          <ToggleButton value="us">American</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary">
          English is played only from real native-speaker recordings (Wikimedia Commons). Words without a recording
          stay silent.
        </Typography>
      </Stack>

      <FormControlLabel
        control={<Switch checked={settings.dictionary} onChange={(e) => onChange({ dictionary: e.target.checked })} />}
        label={
          <Stack>
            <Typography variant="body2">Online dictionary</Typography>
            <Typography variant="caption" color="text.secondary">
              Wiktionary definitions, and accepts correct synonyms not in the word list
            </Typography>
          </Stack>
        }
      />
    </Stack>
  )
}
