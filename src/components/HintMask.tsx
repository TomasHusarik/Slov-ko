import Box from '@mui/material/Box'
import { maskAnswer } from '../utils/text'

interface HintMaskProps {
  answer: string
  revealed: number
  /** Show every letter (used once the answer is known). */
  full?: boolean
}

export function HintMask({ answer, revealed, full = false }: HintMaskProps) {
  const chars = maskAnswer(answer, full ? Infinity : revealed)
  return (
    <Box
      aria-label={full ? answer : `Hint: ${revealed} letter${revealed === 1 ? '' : 's'} revealed`}
      sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0.75 }}
    >
      {chars.map(({ char, isLetter, revealed: shown }, i) =>
        isLetter ? (
          <Box
            key={i}
            aria-hidden
            sx={{
              width: '1.6em',
              height: '2em',
              display: 'grid',
              placeItems: 'center',
              fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
              fontWeight: 700,
              fontSize: '1.15rem',
              borderBottom: 3,
              borderColor: shown ? 'primary.main' : 'divider',
              color: shown ? 'text.primary' : 'transparent',
              transition: 'border-color 200ms, color 200ms',
            }}
          >
            {shown ? char : '_'}
          </Box>
        ) : (
          <Box key={i} aria-hidden sx={{ width: char === ' ' ? '0.9em' : 'auto', alignSelf: 'end', pb: 0.5 }}>
            {char === ' ' ? '' : char}
          </Box>
        ),
      )}
    </Box>
  )
}
