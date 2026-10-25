import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { keyframes } from '@mui/material/styles'
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded'
import TrackChangesRoundedIcon from '@mui/icons-material/TrackChangesRounded'
import HourglassBottomRoundedIcon from '@mui/icons-material/HourglassBottomRounded'
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded'
import type { SessionState } from '../session/session'

const bump = keyframes`
  0% { transform: scale(1); }
  35% { transform: scale(1.45) rotate(-8deg); }
  100% { transform: scale(1); }
`

interface StatTileProps {
  icon: ReactNode
  label: string
  value: ReactNode
  accent?: string
}

function StatTile({ icon, label, value, accent }: StatTileProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ color: accent ?? 'text.secondary', display: 'grid', placeItems: 'center' }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" component="p" sx={{ lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {label}
        </Typography>
      </Box>
    </Paper>
  )
}

export function StatsBar({ state }: { state: SessionState }) {
  const { stats, wordIds, mastered } = state
  const total = wordIds.length
  const accuracy = stats.attempts ? Math.round((stats.correct / stats.attempts) * 100) : null
  const hot = stats.streak >= 3

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' } }}>
        <StatTile
          label={`Streak · best ${stats.bestStreak}`}
          value={stats.streak}
          accent={hot ? 'secondary.main' : undefined}
          icon={
            <LocalFireDepartmentRoundedIcon
              key={stats.streak}
              sx={{ fontSize: 28, animation: stats.streak > 0 ? `${bump} 450ms ease-out` : 'none' }}
            />
          }
        />
        <StatTile
          label="Accuracy"
          value={accuracy === null ? '—' : `${accuracy}%`}
          accent="primary.main"
          icon={<TrackChangesRoundedIcon sx={{ fontSize: 28 }} />}
        />
        <StatTile
          label="Words left"
          value={total - mastered.length}
          icon={<HourglassBottomRoundedIcon sx={{ fontSize: 28 }} />}
        />
        <StatTile
          label="Mastered"
          value={mastered.length}
          accent="success.main"
          icon={<WorkspacePremiumRoundedIcon sx={{ fontSize: 28 }} />}
        />
      </Box>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <LinearProgress
          variant="determinate"
          value={total ? (mastered.length / total) * 100 : 0}
          aria-label="Session progress"
          sx={{ flex: 1, height: 8, borderRadius: 4 }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          <strong>{stats.score}</strong> pts · {stats.hintsUsed} hint{stats.hintsUsed === 1 ? '' : 's'}
        </Typography>
      </Stack>
    </Stack>
  )
}
