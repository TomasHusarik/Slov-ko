import type { CefrLevel } from '../types'

/** Long-term, cross-session record of how each word has gone. */
export interface WordHistory {
  level: CefrLevel
  cs: string
  en: string
  hits: number
  misses: number
  lastMissedAt?: number
}

export type MistakeHistory = Record<string, WordHistory>

export function troubleScore(entry: WordHistory | undefined): number {
  return entry ? entry.misses - entry.hits * 0.5 : 0
}

export function topTroubleWords(history: MistakeHistory, limit: number): [string, WordHistory][] {
  return Object.entries(history)
    .filter(([, entry]) => entry.misses > 0 && troubleScore(entry) > 0)
    .sort(([, a], [, b]) => troubleScore(b) - troubleScore(a) || (b.lastMissedAt ?? 0) - (a.lastMissedAt ?? 0))
    .slice(0, limit)
}
