// Word bank generated from Wiktionary by scripts/build-wordbank.ts (run `bun run wordbank` to refresh).
// Meanings: English Wiktionary (CC BY-SA 4.0). Frequency ranks: SYN2015, Czech National Corpus (CC BY 4.0).

import type { CefrLevel, WordPair } from '../../types'
import { slugify } from '../../utils/text'
import meta from './meta.json'

/** `[czech, englishAnswers, partOfSpeech, frequencyRank]` */
type BankEntry = [cs: string, en: string[], pos: string, rank: number]

// One lazily loaded chunk per level.
const loaders: Record<CefrLevel, () => Promise<{ default: unknown }>> = {
  A1: () => import('./a1.json'),
  A2: () => import('./a2.json'),
  B1: () => import('./b1.json'),
  B2: () => import('./b2.json'),
  C1: () => import('./c1.json'),
  C2: () => import('./c2.json'),
}

export const wordbankMeta = meta as {
  generatedAt: string
  counts: Record<string, number>
  sources: { frequency: string; meanings: string }
}

export function wordbankCount(level: CefrLevel): number {
  return wordbankMeta.counts[level.toLowerCase()] ?? 0
}

/** Loads a level's Wiktionary words, skipping any Czech headword in `exclude` (the curated list wins). */
export async function loadWordbank(level: CefrLevel, exclude: ReadonlySet<string>): Promise<WordPair[]> {
  const entries = (await loaders[level]()).default as BankEntry[]
  const seen = new Set<string>()
  const words: WordPair[] = []
  for (const [cs, en, pos, rank] of entries) {
    if (exclude.has(cs.toLowerCase())) continue
    const base = `${level.toLowerCase()}-wk-${slugify(cs)}`
    let id = base
    for (let n = 2; seen.has(id); n++) id = `${base}-${n}`
    seen.add(id)
    words.push({ id, level, cs, en, source: 'wiktionary', pos, rank })
  }
  return words
}
