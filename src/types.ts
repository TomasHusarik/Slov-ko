export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

export type CefrLevel = (typeof CEFR_LEVELS)[number]

export interface WordPair {
  /** Stable id derived from level + Czech headword, used as the persistence key. */
  id: string
  level: CefrLevel
  cs: string
  /** Accepted English translations; the first one is the canonical answer used for hints. */
  en: string[]
  /** Hand-curated list, or generated from Wiktionary by scripts/build-wordbank.ts. */
  source: 'curated' | 'wiktionary'
  /** Part of speech (Wiktionary words only). */
  pos?: string
  /** Frequency rank in the SYN2015 corpus (Wiktionary words only); lower = more common. */
  rank?: number
}

export function isCefrLevel(value: unknown): value is CefrLevel {
  return typeof value === 'string' && (CEFR_LEVELS as readonly string[]).includes(value)
}
