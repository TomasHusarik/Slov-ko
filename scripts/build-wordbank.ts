/**
 * Builds the Wiktionary word bank: src/data/wordbank/{a1..c2}.json
 *
 *   1. Frequency ranks come from "Wiktionary:Frequency lists/Czech wordlist" — the 15,000 most
 *      frequent Czech lemmas of the SYN2015 corpus (Czech National Corpus, CC BY 4.0).
 *   2. English meanings come from the Czech section of each lemma's Wiktionary entry (CC BY-SA 4.0),
 *      fetched 50 pages per API request, sequentially and politely.
 *   3. CEFR level is assigned by frequency rank (see LEVELS). Words already in the hand-curated
 *      lists (src/data/vocabulary) are skipped, so curated translations always win.
 *
 * Usage:  bun run wordbank            (all 15,000 ranks)
 *         bun run wordbank --limit 2000
 *         bun run wordbank --fresh     (ignore the resume cache, e.g. after changing the parser)
 *
 * Progress is saved after every batch to node_modules/.cache/wordbank/lookups.jsonl, so an
 * interrupted run continues where it stopped.
 */
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'

const API = 'https://en.wiktionary.org/w/api.php'
const FREQUENCY_PAGE = 'Wiktionary:Frequency lists/Czech wordlist'
const USER_AGENT = 'SlovickoWordbankBuilder/1.0 (Czech-English vocabulary trainer; build-time script)'
const BATCH_SIZE = 50
const PAUSE_MS = 400
/** A few requests in flight at once — still gentle on Wikimedia, but ~3× faster than strictly serial. */
const CONCURRENCY = 3
const CACHE_DIR = new URL('../node_modules/.cache/wordbank/', import.meta.url)
const CACHE_FILE = new URL('lookups.jsonl', CACHE_DIR)
const MAX_ANSWERS = 6
const OUT_DIR = new URL('../src/data/wordbank/', import.meta.url)
const CURATED_DIR = new URL('../src/data/vocabulary/', import.meta.url)

/** Highest frequency rank that still belongs to each level. */
const LEVELS: [level: string, maxRank: number][] = [
  ['a1', 800],
  ['a2', 2000],
  ['b1', 4000],
  ['b2', 7000],
  ['c1', 10500],
  ['c2', Infinity],
]

/** Parts of speech we drill. A word is only used if its *main* (first-listed) part of speech is one of these. */
const PARTS_OF_SPEECH = new Set([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'numeral',
  'interjection',
  'pronoun',
  'preposition',
  'conjunction',
  'determiner',
])

/** Every heading Wiktionary uses for a part of speech, so we know which one is listed first. */
const ANY_PART_OF_SPEECH = new Set([
  ...PARTS_OF_SPEECH,
  'proper noun',
  'particle',
  'prefix',
  'suffix',
  'letter',
  'symbol',
  'abbreviation',
  'contraction',
  'phrase',
  'prepositional phrase',
  'proverb',
  'article',
  'postposition',
])

/** Glosses containing these never become answers. */
const BLOCKED_WORDS =
  /\b(semen|cum|fuck\w*|shit\w*|penis|vagina|sex(ual)?|ejaculat\w*|arse|ass|whore|bitch|piss\w*|cunt|dick|cock|prostitut\w*|bastard|faggot|nigg\w*|retard\w*)\b/i

/** Senses with these labels are not useful (or appropriate) as translation targets. */
const SKIP_LABELS =
  /^(obsolete|archaic|rare|dialectal|dialect|regional|vulgar|offensive|derogatory|pejorative|slur|ethnic slur|historical|nonstandard|non-standard|common czech|moravian|bohemian|slang|childish|baby talk|internet slang)$/i

/** Templates that make a whole definition line unusable (inflections, cross-references, non-glosses). */
const SKIP_TEMPLATES = new Set([
  'n-g',
  'ng',
  'non-gloss',
  'non-gloss definition',
  'ngd',
  'surname',
  'given name',
  'place',
  'alt form',
  'alt sp',
  'abbr of',
  'only used in',
  'only in',
  'syn of',
  'clipping',
])

/** Descriptive glosses ("relating to …") explain a word but aren't answers a learner would type. */
const DESCRIPTIVE =
  /^(relating to|pertaining to|of or |used |one who|someone|something|a person|person who|the act|act of|state of|quality of|having |being |the state|the quality|the process|a kind of|a type of|any of|in a .* manner)/i

type Entry = [cs: string, en: string[], pos: string, rank: number]

interface ApiPage {
  title: string
  revisions?: { slots?: { main?: { content?: string } } }[]
}

interface ApiResponse {
  error?: { code: string; info: string }
  query?: {
    pages?: ApiPage[]
    normalized?: { from: string; to: string }[]
    redirects?: { from: string; to: string }[]
  }
}

// ------------------------------------------------------------------ HTTP

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function api(params: Record<string, string>, attempt = 1): Promise<ApiResponse> {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params })}`
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT } })
  const retryAfter = Number(response.headers.get('retry-after')) || 0
  if (response.status === 429 || response.status >= 500) {
    if (attempt > 6) throw new Error(`HTTP ${response.status} after ${attempt} attempts`)
    await sleep(Math.max(retryAfter * 1000, 2000 * 2 ** attempt))
    return api(params, attempt + 1)
  }
  const data = (await response.json()) as ApiResponse
  if (data.error?.code === 'maxlag') {
    await sleep(Math.max(retryAfter, 5) * 1000)
    return api(params, attempt + 1)
  }
  if (data.error) throw new Error(`${data.error.code}: ${data.error.info}`)
  return data
}

async function pageContent(titles: string[]): Promise<Map<string, string>> {
  const data = await api({
    action: 'query',
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    redirects: '1',
    titles: titles.join('|'),
  })
  const byTitle = new Map<string, string>()
  for (const page of data.query?.pages ?? []) {
    const content = page.revisions?.[0]?.slots?.main?.content
    if (content) byTitle.set(page.title, content)
  }
  // Map redirected/normalised titles back to what we asked for.
  for (const hop of [...(data.query?.normalized ?? []), ...(data.query?.redirects ?? [])]) {
    const content = byTitle.get(hop.to)
    if (content && !byTitle.has(hop.from)) byTitle.set(hop.from, content)
  }
  return byTitle
}

// ------------------------------------------------------------------ wikitext parsing

function czechSection(wikitext: string): string | null {
  const start = wikitext.search(/(^|\n)==\s*Czech\s*==[ \t]*\n/)
  if (start === -1) return null
  const body = wikitext.slice(start).replace(/^\n?==\s*Czech\s*==[ \t]*\n/, '')
  const end = body.search(/\n==[^=]/)
  return end === -1 ? body : body.slice(0, end)
}

/** Expands the handful of templates that carry gloss text; returns null if the line should be skipped. */
function expandTemplates(text: string): string | null {
  let out = text
  let skip = false
  for (let pass = 0; pass < 10 && out.includes('{{'); pass++) {
    out = out.replace(/\{\{([^{}]*)\}\}/g, (_, body: string) => {
      const parts = body.split('|').map((p) => p.trim())
      const name = parts[0].toLowerCase()
      const args = parts.slice(1).filter((p) => !/^[a-z0-9_-]+=/i.test(p))
      if (SKIP_TEMPLATES.has(name) || name.endsWith(' of') || / of$/.test(name)) {
        skip = true
        return ''
      }
      switch (name) {
        case 'l':
        case 'll':
        case 'm':
        case 'l-lite':
        case 'link':
          return (args[2] || args[1] || '').split('#')[0]
        case 'w':
        case 'wp':
        case 'wikipedia':
          return args[1] || args[0] || ''
        case 'lb':
        case 'lbl':
        case 'label':
        case 'tlb':
          if (args.slice(1).some((label) => SKIP_LABELS.test(label))) skip = true
          return ''
        case 'gloss':
        case 'gl':
          return `(${args[0] ?? ''})`
        case 'vern':
          return args[0] ?? ''
        default:
          return '' // qualifiers, senses, taxonomic names, formatting…
      }
    })
    if (skip) return null
  }
  return out
}

function cleanWikitext(line: string): string | null {
  const expanded = expandTemplates(line.replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, ''))
  if (expanded === null) return null
  return expanded
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1') // [[target|label]] / [[target]]
    .replace(/<[^>]+>/g, '')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const stripDiacritics = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function candidatesFrom(definition: string, lemma: string): string[] {
  return definition
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .split(';')
    .flatMap((sense) => sense.split(','))
    .map((part) => part.trim().replace(/[.:!]+$/, '').replace(/^to /i, '').trim())
    .filter(
      (part) =>
        /^[a-z][a-z' -]*[a-z]$/i.test(part) &&
        part.length <= 32 &&
        part.split(' ').length <= 4 &&
        !DESCRIPTIVE.test(part) &&
        !BLOCKED_WORDS.test(part) &&
        stripDiacritics(part) !== stripDiacritics(lemma),
    )
}

/** Function words; among very frequent lemmas they are far more likely than a homonymous noun. */
const FUNCTION_WORDS = new Set(['preposition', 'conjunction', 'pronoun', 'determiner'])
const FUNCTION_WORD_MAX_RANK = 1000

interface PosBlock {
  pos: string
  answers: string[]
}

function parseEntry(lemma: string, wikitext: string, rank: number): { en: string[]; pos: string } | null {
  const section = czechSection(wikitext)
  if (!section) return null

  // Collect each part-of-speech block (across etymologies) in page order.
  const blocks: PosBlock[] = []
  let current: PosBlock | null = null
  let definitions = 0
  for (const line of section.split('\n')) {
    const header = line.match(/^={3,6}\s*([^=]+?)\s*={3,6}\s*$/)
    if (header) {
      const heading = header[1].toLowerCase()
      if (!ANY_PART_OF_SPEECH.has(heading)) continue
      current = { pos: heading, answers: [] }
      blocks.push(current)
      definitions = 0
      continue
    }
    if (!current || !PARTS_OF_SPEECH.has(current.pos) || !/^#[^:*#]/.test(line)) continue // definitions only
    const text = cleanWikitext(line.replace(/^#\s*/, ''))
    if (!text) continue
    const found = candidatesFrom(text, lemma)
    if (!found.length) continue
    // All synonyms of the first sense; just the headline gloss of later senses (they get obscure fast).
    for (const candidate of definitions === 0 ? found : found.slice(0, 1)) {
      if (!current.answers.some((a) => a.toLowerCase() === candidate.toLowerCase())) current.answers.push(candidate)
    }
    definitions++
  }

  // The main meaning is the first-listed part of speech — except that a very frequent word with a
  // function-word reading uses that ("bez" = without, not the elder tree listed under Etymology 1).
  const functionBlock =
    rank <= FUNCTION_WORD_MAX_RANK ? blocks.find((b) => FUNCTION_WORDS.has(b.pos) && b.answers.length) : undefined
  const main = functionBlock ?? blocks[0]
  if (!main || !PARTS_OF_SPEECH.has(main.pos) || !main.answers.length) return null
  return { en: main.answers.slice(0, MAX_ANSWERS), pos: main.pos }
}

/** Placeholders and fragments that make a gloss a description rather than an answer to type. */
const PLACEHOLDERS = /\b(sb|sth|someone|somebody|something|somewhere|one's|etc)\b|\bor\b|\bof$/i

/**
 * Final clean-up, applied to fresh and cached lookups alike: drops placeholder/description glosses,
 * strips leading articles ("a single hair" → "single hair"), and drops "-ly" adverbs listed for verbs
 * (a comma-split artefact of glosses like "excitedly, verbosely … describe").
 */
function refineAnswers(answers: string[], pos: string): string[] {
  const out: string[] = []
  for (const raw of answers) {
    const answer = raw.replace(/\s+/g, ' ').replace(/^(a|an|the) /i, '').trim()
    if (!answer || PLACEHOLDERS.test(answer)) continue
    if (pos === 'verb' && /^[a-z]+ly$/i.test(answer)) continue
    if (!out.some((a) => a.toLowerCase() === answer.toLowerCase())) out.push(answer)
  }
  return out
}

// ------------------------------------------------------------------ main

async function curatedHeadwords(): Promise<Set<string>> {
  const words = new Set<string>()
  for (const level of LEVELS.map(([l]) => l)) {
    const source = await readFile(new URL(`${level}.ts`, CURATED_DIR), 'utf8')
    for (const match of source.matchAll(/^\s*\['([^']+)',/gm)) words.add(match[1].toLowerCase())
  }
  return words
}

async function main() {
  const limitArg = process.argv.indexOf('--limit')
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity

  console.log('Fetching frequency list…')
  const freq = await api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: FREQUENCY_PAGE })
  const listText = freq.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content
  if (!listText) throw new Error(`Could not read ${FREQUENCY_PAGE}`)
  const ranked = [...new Set([...listText.matchAll(/\[\[([^\]#|]+)#Czech/g)].map((m) => m[1].trim()))].slice(0, limit)
  console.log(`  ${ranked.length} ranked lemmas`)

  const curated = await curatedHeadwords()
  // Lowercase Czech words only: drops proper nouns, abbreviations, numbers and multi-word items.
  const lemmas = ranked
    .map((lemma, i) => ({ lemma, rank: i + 1 }))
    .filter(({ lemma }) => /^[a-záčďéěíňóřšťúůýž]{2,}$/.test(lemma) && !curated.has(lemma))
  console.log(`  ${lemmas.length} to look up (${curated.size} curated words skipped)`)

  // Resume: every looked-up lemma (usable or not) is recorded as one JSON line.
  await mkdir(CACHE_DIR, { recursive: true })
  if (process.argv.includes('--fresh')) await rm(CACHE_FILE, { force: true })
  const done = new Map<string, Entry | null>()
  const cached = await readFile(CACHE_FILE, 'utf8').catch(() => '')
  for (const line of cached.split('\n').filter(Boolean)) {
    const { lemma, entry } = JSON.parse(line) as { lemma: string; entry: Entry | null }
    done.set(lemma, entry)
  }
  const todo = lemmas.filter(({ lemma }) => !done.has(lemma))
  if (done.size) console.log(`  resuming: ${done.size} already looked up, ${todo.length} left`)

  const batches: (typeof lemmas)[] = []
  for (let i = 0; i < todo.length; i += BATCH_SIZE) batches.push(todo.slice(i, i + BATCH_SIZE))
  let next = 0
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++]
      const pages = await pageContent(batch.map((b) => b.lemma))
      const lines = batch.map(({ lemma, rank }) => {
        const wikitext = pages.get(lemma)
        const parsed = wikitext ? parseEntry(lemma, wikitext, rank) : null
        const entry: Entry | null = parsed ? [lemma, parsed.en, parsed.pos, rank] : null
        done.set(lemma, entry)
        return JSON.stringify({ lemma, entry })
      })
      await appendFile(CACHE_FILE, lines.join('\n') + '\n')
      const usable = [...done.values()].filter(Boolean).length
      process.stdout.write(`\r  ${done.size}/${lemmas.length} looked up, ${usable} usable   `)
      await sleep(PAUSE_MS)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log()

  const entries = lemmas
    .map(({ lemma }) => done.get(lemma))
    .filter((e): e is Entry => Boolean(e))
    .map(([cs, en, pos, rank]): Entry => [cs, refineAnswers(en, pos), pos, rank])
    .filter(([, en]) => en.length > 0)

  await mkdir(OUT_DIR, { recursive: true })
  const counts: Record<string, number> = {}
  let minRank = 0
  for (const [level, maxRank] of LEVELS) {
    const inLevel = entries.filter(([, , , rank]) => rank > minRank && rank <= maxRank)
    counts[level] = inLevel.length
    await writeFile(new URL(`${level}.json`, OUT_DIR), JSON.stringify(inLevel) + '\n')
    minRank = maxRank
  }
  const meta = {
    generatedAt: new Date().toISOString().slice(0, 10),
    ranks: ranked.length,
    counts,
    sources: {
      frequency: 'Wiktionary:Frequency lists/Czech wordlist (SYN2015, Czech National Corpus, CC BY 4.0)',
      meanings: 'English Wiktionary, Czech entries (CC BY-SA 4.0)',
    },
  }
  await writeFile(new URL('meta.json', OUT_DIR), JSON.stringify(meta, null, 2) + '\n')
  console.log('Done:', counts)
}

await main()
