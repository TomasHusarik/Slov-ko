// Online dictionary backed by Wiktionary / Wikimedia Commons: free, no API key, CORS-enabled.
// Everything here is an optional enhancement: any failure resolves to `null` and the app carries on.

import { readStored, writeStored } from '../utils/storage'

export type Accent = 'us' | 'uk'

export interface EnglishEntry {
  partOfSpeech: string
  definition: string
  example?: string
}

export interface Recording {
  accent: 'us' | 'uk'
  url: string
}

const REST = 'https://en.wiktionary.org/api/rest_v1/page/definition/'
const ACTION = 'https://en.wiktionary.org/w/api.php'
export const WIKTIONARY_PAGE = 'https://en.wiktionary.org/wiki/'

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MIN_GAP_MS = 250
const BACKOFF_MS = 60_000
const TIMEOUT_MS = 6000

// ---------------------------------------------------------------- request queue

let lastRequest = Promise.resolve()
let blockedUntil = 0

class NotFound extends Error {}

/** Serialises requests with a small gap and backs off entirely after HTTP 429. */
function throttledJson(url: string): Promise<unknown> {
  const run = lastRequest.then(async () => {
    if (Date.now() < blockedUntil) throw new Error('Dictionary temporarily rate-limited')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (response.status === 429) {
        blockedUntil = Date.now() + BACKOFF_MS
        throw new Error('Rate-limited by Wiktionary')
      }
      if (response.status === 404) throw new NotFound(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return (await response.json()) as unknown
    } finally {
      clearTimeout(timer)
    }
  })
  lastRequest = run.then(
    () => wait(MIN_GAP_MS),
    () => wait(MIN_GAP_MS),
  )
  return run
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// ---------------------------------------------------------------- cache

interface CacheRecord<T> {
  at: number
  value: T | null
}

const memory = new Map<string, Promise<unknown>>()
const settled = new Map<string, unknown>()

/** Synchronous read of a lookup that has already finished (undefined = not looked up yet). */
export function peekCached<T>(key: string): T | null | undefined {
  if (settled.has(key)) return settled.get(key) as T | null
  const stored = readStored<CacheRecord<T> | null>(`dict:${key}`, null)
  if (stored && Date.now() - stored.at < CACHE_TTL_MS) return stored.value
  return undefined
}

/** Memory + localStorage cache. Confirmed "not found" results are cached too; transient errors are not. */
function cached<T>(key: string, load: () => Promise<T | null>): Promise<T | null> {
  const hit = memory.get(key)
  if (hit) return hit as Promise<T | null>

  const stored = readStored<CacheRecord<T> | null>(`dict:${key}`, null)
  if (stored && Date.now() - stored.at < CACHE_TTL_MS) {
    const value = Promise.resolve(stored.value)
    memory.set(key, value)
    settled.set(key, stored.value)
    return value
  }

  const pending = load().then(
    (value) => {
      writeStored(`dict:${key}`, { at: Date.now(), value } satisfies CacheRecord<T>)
      settled.set(key, value)
      return value
    },
    (error: unknown) => {
      memory.delete(key)
      if (error instanceof NotFound) {
        writeStored(`dict:${key}`, { at: Date.now(), value: null } satisfies CacheRecord<T>)
        settled.set(key, null)
      }
      return null
    },
  )
  memory.set(key, pending)
  return pending
}

// ---------------------------------------------------------------- parsing helpers

interface RestDefinition {
  definition: string
  examples?: string[]
}

interface RestUsage {
  partOfSpeech: string
  language: string
  definitions: RestDefinition[]
}

type RestResponse = Record<string, RestUsage[] | undefined>

const pageTitle = (term: string) => encodeURIComponent(term.trim().replace(/ /g, '_'))

/** Wiktionary returns HTML snippets (with inline <style>); reduce them to plain text. */
function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('style, sup, .HQToggle, .nyms').forEach((node) => node.remove())
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** "form of" lines (e.g. "genitive plural of pes") are inflections, not meanings. */
const isFormOf = (definition: RestDefinition) =>
  definition.definition.includes('form-of-definition') || definition.definition.trim() === ''

/** Turns "to remember (to recall) [with na]" / "scoundrel, bad person" into answer candidates. */
function glossesFrom(text: string): string[] {
  return text
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .split(/[,;]/)
    .map((part) => part.trim().toLowerCase().replace(/^to /, '').replace(/\.$/, ''))
    .filter((part) => part.length > 1 && part.split(' ').length <= 4 && !/[:=]/.test(part))
}

// ---------------------------------------------------------------- public API

/** English meanings Wiktionary lists for a Czech word (used to accept valid synonyms). */
export function lookupCzechGlosses(cs: string): Promise<string[] | null> {
  return cached(`cs:${cs.toLowerCase()}`, async () => {
    // Reflexive verbs ("pamatovat si", "vyhnout se") are listed under the bare verb.
    const titles = [cs, cs.replace(/ (si|se)$/, '')].filter((t, i, all) => all.indexOf(t) === i)
    for (const title of titles) {
      try {
        const data = (await throttledJson(REST + pageTitle(title))) as RestResponse
        const glosses = (data.cs ?? [])
          .flatMap((usage) => usage.definitions.filter((d) => !isFormOf(d)))
          .flatMap((d) => glossesFrom(htmlToText(d.definition)))
        if (glosses.length > 0) return [...new Set(glosses)]
      } catch (error) {
        if (!(error instanceof NotFound)) throw error
      }
    }
    throw new NotFound(cs)
  })
}

/** Part of speech, first definition and an example for an English word. */
export function lookupEnglish(en: string): Promise<EnglishEntry | null> {
  return cached(`en:${en.toLowerCase()}`, async () => {
    const data = (await throttledJson(REST + pageTitle(en))) as RestResponse
    for (const usage of data.en ?? []) {
      const definition = usage.definitions.find((d) => !isFormOf(d))
      if (!definition) continue
      const example = definition.examples?.map(htmlToText).find(Boolean)
      return { partOfSpeech: usage.partOfSpeech, definition: htmlToText(definition.definition), example }
    }
    throw new NotFound(en)
  })
}

interface ActionResponse {
  query?: {
    pages?: { title: string; videoinfo?: { url: string; derivatives?: { src: string; type: string }[] }[] }[]
  }
}

function accentOf(title: string): Recording['accent'] | null {
  const name = title.replace(/^File:/i, '').toLowerCase()
  if (/^en-us[-_ ]/.test(name)) return 'us'
  if (/^en-(uk|gb)[-_ ]/.test(name)) return 'uk'
  return null
}

/** Real human recordings of an English word from Wikimedia Commons (mp3 transcodes, playable everywhere). */
export const recordingsKey = (en: string) => `audio2:${en.toLowerCase()}`

export function lookupRecordings(en: string): Promise<Recording[] | null> {
  return cached(recordingsKey(en), async () => {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      origin: '*',
      generator: 'images',
      titles: en.trim(),
      gimlimit: '50',
      prop: 'videoinfo',
      viprop: 'url|derivatives',
    })
    const data = (await throttledJson(`${ACTION}?${params}`)) as ActionResponse
    const recordings = (data.query?.pages ?? []).flatMap((page): Recording[] => {
      const accent = accentOf(page.title)
      const info = page.videoinfo?.[0]
      if (!accent || !info) return []
      const mp3 = info.derivatives?.find((d) => d.type.startsWith('audio/mpeg'))?.src
      return [{ accent, url: mp3 ?? info.url }]
    })
    if (recordings.length === 0) throw new NotFound(en)
    return recordings
  })
}

export function pickRecording(recordings: readonly Recording[], accent: Accent): Recording | undefined {
  const order: Recording['accent'][] = accent === 'us' ? ['us', 'uk'] : ['uk', 'us']
  return [...recordings].sort((a, b) => order.indexOf(a.accent) - order.indexOf(b.accent))[0]
}
