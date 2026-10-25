import { useEffect, useState } from 'react'
import type { CefrLevel } from '../types'
import { vocabularyService, type LoadedVocabulary } from '../services/vocabularyService'

type Result =
  | { level: CefrLevel; status: 'ready'; data: LoadedVocabulary }
  | { level: CefrLevel; status: 'error'; error: string }

export type VocabularyState = Result | { status: 'loading' }

export function useVocabulary(level: CefrLevel): VocabularyState {
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    let cancelled = false
    vocabularyService.load(level).then(
      (data) => !cancelled && setResult({ level, status: 'ready', data }),
      (error: unknown) =>
        !cancelled && setResult({ level, status: 'error', error: error instanceof Error ? error.message : String(error) }),
    )
    return () => {
      cancelled = true
    }
  }, [level])

  // A result for a previous level means the new one is still loading.
  return result && result.level === level ? result : { status: 'loading' }
}
