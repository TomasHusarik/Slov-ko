import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import { WIKTIONARY_PAGE, lookupCzechGlosses, lookupEnglish } from '../services/dictionaryService'
import { useLookup } from '../hooks/useLookup'

const MAX_GLOSSES = 6

/** Wiktionary details shown after answering: English definition plus other meanings of the Czech word. */
export function DictionaryPanel({ cs, en }: { cs: string; en: string }) {
  const english = useLookup(en, lookupEnglish)
  const czech = useLookup(cs, lookupCzechGlosses)
  const loading = english.status === 'loading' || czech.status === 'loading'
  const entry = english.status === 'done' ? english.value : null
  const glosses = czech.status === 'done' ? (czech.value ?? []).slice(0, MAX_GLOSSES) : []

  if (!loading && !entry && glosses.length === 0) return null

  return (
    <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'action.hover' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <MenuBookRoundedIcon fontSize="small" color="primary" />
        <Typography variant="subtitle2">Dictionary</Typography>
        <Box sx={{ flex: 1 }} />
        <Link
          variant="caption"
          color="text.secondary"
          href={WIKTIONARY_PAGE + encodeURIComponent(en.replace(/ /g, '_'))}
          target="_blank"
          rel="noreferrer"
        >
          Wiktionary · CC BY-SA
        </Link>
      </Stack>

      {loading && !entry ? (
        <>
          <Skeleton width="40%" />
          <Skeleton />
        </>
      ) : (
        entry && (
          <Typography variant="body2" sx={{ mb: glosses.length ? 1.5 : 0 }}>
            <strong lang="en">{en}</strong>{' '}
            <Typography component="span" variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {entry.partOfSpeech.toLowerCase()}
            </Typography>
            {' — '}
            {entry.definition}
            {entry.example && (
              <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic', mt: 0.5 }}>
                “{entry.example}”
              </Typography>
            )}
          </Typography>
        )
      )}

      {glosses.length > 0 && (
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }} lang="cs">
            {cs} can also mean:
          </Typography>
          {glosses.map((gloss) => (
            <Chip key={gloss} size="small" label={gloss} variant="outlined" />
          ))}
        </Stack>
      )}
    </Box>
  )
}
