import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import type { PaletteMode } from '@mui/material/styles'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded'
import MusicOffRoundedIcon from '@mui/icons-material/MusicOffRounded'
import RecordVoiceOverRoundedIcon from '@mui/icons-material/RecordVoiceOverRounded'
import VoiceOverOffRoundedIcon from '@mui/icons-material/VoiceOverOffRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded'
import type { CefrLevel } from '../types'
import { LEVEL_INFO } from '../data/levels'

interface AppHeaderProps {
  level: CefrLevel
  mode: PaletteMode
  soundOn: boolean
  speechOn: boolean
  onOpenLevels: () => void
  onToggleMode: () => void
  onToggleSound: () => void
  onToggleSpeech: () => void
}

export function AppHeader({
  level,
  mode,
  soundOn,
  speechOn,
  onOpenLevels,
  onToggleMode,
  onToggleSound,
  onToggleSpeech,
}: AppHeaderProps) {
  const info = LEVEL_INFO[level]
  return (
    <AppBar
      position="sticky"
      elevation={0}
      color="transparent"
      sx={{
        top: 'env(safe-area-inset-top, 0px)',
        backdropFilter: 'blur(12px)',
        bgcolor: (t) => alpha(t.palette.background.default, 0.75),
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ gap: { xs: 0.25, sm: 1 } }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            color: 'primary.contrastText',
            background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
          }}
        >
          <TranslateRoundedIcon fontSize="small" />
        </Box>
        <Box sx={{ mr: 'auto', lineHeight: 1 }}>
          <Typography variant="h6" component="h1" sx={{ lineHeight: 1.1 }}>
            Slovíčko
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
            Czech → English vocabulary
          </Typography>
        </Box>

        <Button
          variant="outlined"
          color="inherit"
          onClick={onOpenLevels}
          endIcon={<ExpandMoreRoundedIcon />}
          aria-label={`Level ${level}, ${info.title}. Change level`}
          sx={{ borderColor: 'divider', pl: 1 }}
        >
          <Box
            component="span"
            sx={{ px: 1, py: 0.25, mr: 1, borderRadius: 1.5, bgcolor: info.color, color: '#fff', fontWeight: 800, fontSize: 13 }}
          >
            {level}
          </Box>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            {info.title}
          </Box>
        </Button>

        <Tooltip title={speechOn ? 'Stop playing the answer automatically' : 'Play the answer’s recording when it is revealed'}>
          <IconButton
            onClick={onToggleSpeech}
            aria-label={speechOn ? 'Stop playing the answer automatically' : 'Play the answer’s recording when it is revealed'}
            aria-pressed={speechOn}
          >
            {speechOn ? <RecordVoiceOverRoundedIcon /> : <VoiceOverOffRoundedIcon />}
          </IconButton>
        </Tooltip>
        <Tooltip title={soundOn ? 'Mute sound effects' : 'Enable sound effects'}>
          <IconButton onClick={onToggleSound} aria-label={soundOn ? 'Mute sound effects' : 'Enable sound effects'} aria-pressed={soundOn}>
            {soundOn ? <MusicNoteRoundedIcon /> : <MusicOffRoundedIcon />}
          </IconButton>
        </Tooltip>
        <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
          <IconButton onClick={onToggleMode} aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {mode === 'dark' ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  )
}
