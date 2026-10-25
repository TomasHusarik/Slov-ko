const LETTER = /[\p{L}\p{N}]/u
const LEADING_FILLER = /^(to|a|an|the) /

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Normalises an answer for comparison: case-insensitive, trimmed, collapsed whitespace,
 * hyphens treated as spaces, trailing punctuation ignored, and a leading "to"/article
 * dropped so "to go" == "go" and "an apple" == "apple".
 */
export function normalizeAnswer(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[-‐–]/g, ' ')
    .replace(/[.!?,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LEADING_FILLER, '')
}

export function isCorrectAnswer(input: string, accepted: readonly string[]): boolean {
  const normalized = normalizeAnswer(input)
  return normalized.length > 0 && accepted.some((answer) => normalizeAnswer(answer) === normalized)
}

/** Optimal string alignment distance: insertions, deletions, substitutions and adjacent swaps cost 1. */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/** How many typos still count as "almost": none for short words, where one letter often makes another word. */
function typoAllowance(length: number): number {
  if (length <= 3) return 0
  if (length <= 7) return 1
  return 2
}

/** Returns the accepted answer the input is a near-miss of (a small typo), if any. */
export function findNearMiss(input: string, accepted: readonly string[]): string | undefined {
  const normalized = normalizeAnswer(input)
  if (!normalized) return undefined
  return accepted.find((answer) => {
    const target = normalizeAnswer(answer)
    const distance = editDistance(normalized, target)
    return distance > 0 && distance <= typoAllowance(target.length)
  })
}

export function isLetter(char: string): boolean {
  return LETTER.test(char)
}

export function countLetters(value: string): number {
  return [...value].filter(isLetter).length
}

export interface MaskedChar {
  char: string
  isLetter: boolean
  revealed: boolean
}

/** Splits the answer into characters, revealing the first `revealed` letters. */
export function maskAnswer(answer: string, revealed: number): MaskedChar[] {
  let letterIndex = 0
  return [...answer].map((char) => {
    if (!isLetter(char)) return { char, isLetter: false, revealed: true }
    const shown = letterIndex < revealed
    letterIndex += 1
    return { char, isLetter: true, revealed: shown }
  })
}

export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
