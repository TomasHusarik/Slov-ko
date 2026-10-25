import type { CefrLevel, WordPair } from '../types'
import { buildWordPairs, type RawEntry } from '../data/vocabulary/buildWordPairs'
import { loadWordbank, wordbankCount } from '../data/wordbank'
import { CEFR_LEVELS } from '../types'

export interface VocabularySource {
  readonly name: string
  load(level: CefrLevel): Promise<WordPair[]>
}

export interface LoadedVocabulary {
  level: CefrLevel
  words: WordPair[]
  source: string
}

// Each level is its own chunk, so only the level being practised is downloaded.
const localLoaders: Record<CefrLevel, () => Promise<{ default: WordPair[] }>> = {
  A1: () => import('../data/vocabulary/a1'),
  A2: () => import('../data/vocabulary/a2'),
  B1: () => import('../data/vocabulary/b1'),
  B2: () => import('../data/vocabulary/b2'),
  C1: () => import('../data/vocabulary/c1'),
  C2: () => import('../data/vocabulary/c2'),
}

export async function loadCurated(level: CefrLevel): Promise<WordPair[]> {
  return (await localLoaders[level]()).default
}

export type LevelSizes = Record<CefrLevel, { curated: number; wiktionary: number }>

/** Word counts per level without loading the (large) word-bank chunks. */
export async function levelSizes(): Promise<LevelSizes> {
  const curated = await Promise.all(CEFR_LEVELS.map(loadCurated))
  return Object.fromEntries(
    CEFR_LEVELS.map((level, i) => [level, { curated: curated[i].length, wiktionary: wordbankCount(level) }]),
  ) as LevelSizes
}

/** Hand-curated words first, then thousands of frequency-ranked words generated from Wiktionary. */
export const localSource: VocabularySource = {
  name: 'Curated list + Wiktionary word bank',
  async load(level) {
    const curated = await loadCurated(level)
    const bank = await loadWordbank(level, new Set(curated.map((w) => w.cs.toLowerCase())))
    return [...curated, ...bank]
  },
}

interface RemoteEntry {
  cs: string
  en: string | string[]
}

function isRemoteEntryList(data: unknown): data is RemoteEntry[] {
  return (
    Array.isArray(data) &&
    data.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.cs === 'string' &&
        (typeof item.en === 'string' ||
          (Array.isArray(item.en) && item.en.length > 0 && item.en.every((e: unknown) => typeof e === 'string'))),
    )
  )
}

const MIN_REMOTE_WORDS = 10

/**
 * Optional HTTP source. Expects `GET {baseUrl}/{a1..c2}.json` returning
 * `[{ "cs": "pes", "en": ["dog"] }, ...]`. Any failure (network, timeout, bad shape,
 * too few words) throws, and the service falls through to the next source.
 */
export function createRemoteSource(baseUrl: string, timeoutMs = 4000): VocabularySource {
  const root = baseUrl.replace(/\/+$/, '')
  return {
    name: 'Remote API',
    async load(level) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(`${root}/${level.toLowerCase()}.json`, { signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data: unknown = await response.json()
        if (!isRemoteEntryList(data)) throw new Error('Unexpected payload shape')
        const words = buildWordPairs(level, data.map((entry): RawEntry => [entry.cs, entry.en]))
        if (words.length < MIN_REMOTE_WORDS) throw new Error(`Only ${words.length} words returned`)
        return words
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

/** Tries each source in order and caches the first successful result per level. */
export class VocabularyService {
  private readonly sources: readonly VocabularySource[]
  private readonly cache = new Map<CefrLevel, Promise<LoadedVocabulary>>()

  constructor(sources: readonly VocabularySource[]) {
    this.sources = sources
  }

  load(level: CefrLevel): Promise<LoadedVocabulary> {
    let pending = this.cache.get(level)
    if (!pending) {
      pending = this.resolve(level)
      this.cache.set(level, pending)
      pending.catch(() => this.cache.delete(level))
    }
    return pending
  }

  private async resolve(level: CefrLevel): Promise<LoadedVocabulary> {
    const errors: unknown[] = []
    for (const source of this.sources) {
      try {
        const words = await source.load(level)
        if (words.length > 0) return { level, words, source: source.name }
      } catch (error) {
        errors.push(error)
        console.warn(`[vocabulary] ${source.name} failed for ${level}, trying next source`, error)
      }
    }
    throw new AggregateError(errors, `No vocabulary source could load level ${level}`)
  }
}

const remoteUrl: string | undefined = import.meta.env.VITE_VOCAB_API_URL

export const vocabularyService = new VocabularyService(
  remoteUrl ? [createRemoteSource(remoteUrl), localSource] : [localSource],
)
