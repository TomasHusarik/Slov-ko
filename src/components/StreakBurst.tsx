import { useEffect, type CSSProperties } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { keyframes } from '@mui/material/styles'
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded'

const PARTICLES = 18
const COLORS = ['#f97316', '#facc15', '#4ade80', '#60a5fa', '#c084fc', '#f472b6']
const CHEERS = ['Nice!', 'On fire!', 'Unstoppable!', 'Legendary!', 'Vocabulary wizard!']
const DURATION_MS = 1600

const fly = keyframes`
  0% { transform: rotate(var(--angle)) translateY(0) scale(1); opacity: 1; }
  100% { transform: rotate(var(--angle)) translateY(-160px) scale(0.3); opacity: 0; }
`

const popIn = keyframes`
  0% { transform: scale(0.4); opacity: 0; }
  25% { transform: scale(1.12); opacity: 1; }
  45% { transform: scale(1); }
  80% { opacity: 1; }
  100% { transform: scale(0.95) translateY(-12px); opacity: 0; }
`

interface StreakBurstProps {
  streak: number
  onDone: () => void
}

/** Full-screen, non-interactive celebration shown when a streak milestone is reached. */
export function StreakBurst({ streak, onDone }: StreakBurstProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, DURATION_MS)
    return () => clearTimeout(timer)
  }, [onDone])

  const cheer = CHEERS[Math.min(Math.floor(streak / 5) - 1, CHEERS.length - 1)] ?? CHEERS[0]

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        display: 'grid',
        placeItems: 'center',
        zIndex: (t) => t.zIndex.snackbar,
      }}
    >
      <Box sx={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
        {Array.from({ length: PARTICLES }, (_, i) => (
          <Box
            key={i}
            style={{ '--angle': `${(360 / PARTICLES) * i}deg` } as CSSProperties}
            sx={{
              position: 'absolute',
              width: i % 3 === 0 ? 12 : 8,
              height: i % 3 === 0 ? 12 : 8,
              borderRadius: i % 2 ? '50%' : '2px',
              bgcolor: COLORS[i % COLORS.length],
              animation: `${fly} 900ms cubic-bezier(.2,.7,.3,1) forwards`,
              animationDelay: `${(i % 4) * 30}ms`,
            }}
          />
        ))}
        <Box
          sx={{
            px: 4,
            py: 2.5,
            borderRadius: 6,
            textAlign: 'center',
            bgcolor: 'background.paper',
            boxShadow: 12,
            border: 2,
            borderColor: 'secondary.main',
            animation: `${popIn} ${DURATION_MS}ms ease-out forwards`,
          }}
        >
          <LocalFireDepartmentRoundedIcon sx={{ fontSize: 48, color: 'secondary.main' }} />
          <Typography variant="h5" component="p">
            {streak} in a row!
          </Typography>
          <Typography color="text.secondary">{cheer}</Typography>
        </Box>
      </Box>
    </Box>
  )
}
