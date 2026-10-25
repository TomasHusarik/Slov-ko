import { useState } from 'react'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded'
import { CEFR_LEVELS, type CefrLevel } from '../types'
import { LEVEL_INFO } from '../data/levels'
import { topTroubleWords, type MistakeHistory } from '../session/history'
import { PronunciationSettings, type PronunciationPatch } from './PronunciationSettings'
import { levelSizes } from '../services/vocabularyService'
import { wordbankMeta } from '../data/wordbank'
import { useLookup } from '../hooks/useLookup'

interface LevelDrawerProps {
  open: boolean
  level: CefrLevel
  history: MistakeHistory
  source: string | null
  onClose: () => void
  onSelectLevel: (level: CefrLevel) => void
  onRestart: () => void
  onClearHistory: () => void
  onPronunciationChange: (patch: PronunciationPatch) => void
}

export function LevelDrawer({
  open,
  level,
  history,
  source,
  onClose,
  onSelectLevel,
  onRestart,
  onClearHistory,
  onPronunciationChange,
}: LevelDrawerProps) {
  const [confirmClear, setConfirmClear] = useState(false)
  const trouble = topTroubleWords(history, 8)
  const sizes = useLookup(open ? 'sizes' : null, levelSizes)
  const sizeOf = (l: CefrLevel) => (sizes.status === 'done' && sizes.value ? sizes.value[l] : null)

  const close = () => {
    setConfirmClear(false)
    onClose()
  }

  return (
    <Drawer anchor="left" open={open} onClose={close} slotProps={{ paper: { sx: { width: { xs: '88vw', sm: 360 } } } }}>
      <Box sx={{ p: 2.5, pb: 1, pt: 'calc(env(safe-area-inset-top, 0px) + 20px)' }}>
        <Typography variant="h6">Choose your level</Typography>
        <Typography variant="body2" color="text.secondary">
          Each level keeps its own saved session.
        </Typography>
      </Box>

      <List sx={{ px: 1 }}>
        {CEFR_LEVELS.map((l) => {
          const info = LEVEL_INFO[l]
          const size = sizeOf(l)
          return (
            <ListItemButton
              key={l}
              selected={l === level}
              onClick={() => {
                onSelectLevel(l)
                close()
              }}
              sx={{ borderRadius: 3, mb: 0.5 }}
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: info.color, color: '#fff', fontWeight: 800, fontSize: 15 }}>{l}</Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={info.title}
                secondary={
                  <>
                    {info.description}
                    {size && (
                      <Typography component="span" variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                        {(size.curated + size.wiktionary).toLocaleString('en')} words · {size.curated} curated +{' '}
                        {size.wiktionary.toLocaleString('en')} from Wiktionary
                      </Typography>
                    )}
                  </>
                }
              />
            </ListItemButton>
          )
        })}
      </List>

      <Divider />

      <Stack spacing={1.5} sx={{ p: 2.5 }}>
        <Button
          variant="contained"
          startIcon={<RestartAltRoundedIcon />}
          onClick={() => {
            onRestart()
            close()
          }}
        >
          Start new {level} session
        </Button>
      </Stack>

      <Divider />

      <Box sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Pronunciation & dictionary
        </Typography>
        <PronunciationSettings onChange={onPronunciationChange} />
      </Box>

      <Divider />

      <Box sx={{ p: 2.5, pb: 1 }}>
        <Typography variant="subtitle2">Trouble words</Typography>
        <Typography variant="caption" color="text.secondary">
          Missed most often — new sessions mix these back in.
        </Typography>
      </Box>
      {trouble.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pb: 2 }}>
          No mistakes recorded yet.
        </Typography>
      ) : (
        <List dense sx={{ px: 1 }}>
          {trouble.map(([id, entry]) => (
            <ListItem
              key={id}
              secondaryAction={<Chip size="small" label={`${entry.misses}×`} color="error" variant="outlined" />}
            >
              <ListItemText primary={entry.cs} secondary={`${entry.en} · ${entry.level}`} />
            </ListItem>
          ))}
        </List>
      )}
      {Object.keys(history).length > 0 && (
        <Box sx={{ px: 2.5, pb: 2 }}>
          <Button
            size="small"
            color={confirmClear ? 'error' : 'inherit'}
            variant={confirmClear ? 'contained' : 'text'}
            startIcon={<DeleteSweepRoundedIcon />}
            onClick={() => {
              if (!confirmClear) return setConfirmClear(true)
              onClearHistory()
              setConfirmClear(false)
            }}
          >
            {confirmClear ? 'Click again to clear history' : 'Clear mistake history'}
          </Button>
        </Box>
      )}

      <Box sx={{ mt: 'auto', p: 2.5, pb: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
        <Typography variant="caption" color="text.secondary" component="p">
          Words: {source ?? 'loading…'}. Word bank from English Wiktionary (CC BY-SA 4.0), ranked by frequency in
          the SYN2015 corpus (Czech National Corpus), built {wordbankMeta.generatedAt}. Progress is saved on this
          device.
        </Typography>
      </Box>
    </Drawer>
  )
}
