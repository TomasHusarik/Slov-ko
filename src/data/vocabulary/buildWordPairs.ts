import type { CefrLevel, WordPair } from '../../types'
import { slugify } from '../../utils/text'

/** Compact authoring format: `[czech, english | [english, ...alternatives]]`. */
export type RawEntry = readonly [cs: string, en: string | readonly string[]]

export function buildWordPairs(level: CefrLevel, entries: readonly RawEntry[]): WordPair[] {
  const seen = new Set<string>()
  return entries.map(([cs, en]) => {
    const base = `${level.toLowerCase()}-${slugify(cs)}`
    let id = base
    for (let n = 2; seen.has(id); n++) id = `${base}-${n}`
    seen.add(id)
    return {
      id,
      level,
      cs: cs.trim(),
      en: (typeof en === 'string' ? [en] : [...en]).map((e) => e.trim()),
      source: 'curated' as const,
    }
  })
}
