import type { CefrLevel, WordPair } from '../types'
import { shuffle } from '../utils/text'
import { readStored, removeStored, writeStored } from '../utils/storage'
import { troubleScore, type MistakeHistory } from './history'

/** Clean correct answers needed to master a word after it was missed or skipped. */
const REQUIRED_AFTER_MISS = 2
/** How many cards later a missed word comes back. */
const RETRY_GAP = 3
/** How many cards later a word answered with hints (or partly recovered) comes back. */
const REVIEW_GAP = 5

const BASE_POINTS = 10
const MAX_STREAK_BONUS = 10
const HINT_PENALTY = 3
const MIN_HINTED_POINTS = 2
const TYPO_PENALTY = 2

export const STREAK_MILESTONE = 5

export type Phase = 'answering' | 'feedback' | 'complete'
export type Outcome = 'correct' | 'incorrect' | 'skipped'

export interface SessionStats {
  attempts: number
  correct: number
  streak: number
  bestStreak: number
  hintsUsed: number
  skips: number
  score: number
  /** Answers flagged as "almost" (a small typo). Optional: sessions saved before this field existed lack it. */
  typos?: number
}

export interface SessionState {
  version: 1
  level: CefrLevel
  wordIds: string[]
  /** Upcoming cards; `queue[0]` is the card on screen. */
  queue: string[]
  /** Clean correct answers still required before a word counts as mastered. */
  remaining: Record<string, number>
  mastered: string[]
  /** Words missed or skipped at least once this session. */
  missed: string[]
  phase: Phase
  /** Increments every time a new card is shown, so card UI can reset via `key`. */
  cardSeq: number
  hintsRevealed: number
  lastAnswer: string
  lastOutcome: Outcome | null
  lastPoints: number
  /** The near-miss the learner typed on this card; they get one chance to fix it. */
  nearMiss?: string | null
  /** Whether the last correct answer matched an online dictionary meaning rather than the word list. */
  acceptedVia?: 'list' | 'dictionary'
  stats: SessionStats
}

export type SessionAction =
  | { type: 'answer'; answer: string; correct: boolean; via?: 'list' | 'dictionary' }
  | { type: 'almost'; answer: string }
  | { type: 'skip' }
  | { type: 'hint'; max: number }
  | { type: 'next' }

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  const current = state.queue[0]
  if (!current) return state

  switch (action.type) {
    case 'answer': {
      if (state.phase !== 'answering') return state
      const stats = { ...state.stats, attempts: state.stats.attempts + 1 }

      if (!action.correct) {
        stats.streak = 0
        return {
          ...state,
          ...markMissed(state, current),
          phase: 'feedback',
          lastAnswer: action.answer,
          lastOutcome: 'incorrect',
          lastPoints: 0,
          stats,
        }
      }

      stats.correct += 1
      const hinted = state.hintsRevealed > 0
      const typoPenalty = state.nearMiss ? TYPO_PENALTY : 0
      let points: number
      let remaining = state.remaining[current] ?? 1
      if (hinted) {
        // Accepted, but the word comes back: mastery requires an unaided answer.
        points = Math.max(MIN_HINTED_POINTS, BASE_POINTS - HINT_PENALTY * state.hintsRevealed - typoPenalty)
        remaining = Math.max(remaining, 1)
      } else {
        stats.streak += 1
        stats.bestStreak = Math.max(stats.bestStreak, stats.streak)
        points = BASE_POINTS + Math.min(stats.streak - 1, MAX_STREAK_BONUS) - typoPenalty
        remaining = Math.max(0, remaining - 1)
      }
      stats.score += points

      return {
        ...state,
        remaining: { ...state.remaining, [current]: remaining },
        phase: 'feedback',
        lastAnswer: action.answer,
        lastOutcome: 'correct',
        lastPoints: points,
        acceptedVia: action.via ?? 'list',
        stats,
      }
    }

    case 'almost': {
      // Only one "almost" per card: a second near-miss is answered as incorrect by the caller.
      if (state.phase !== 'answering' || state.nearMiss) return state
      return {
        ...state,
        nearMiss: action.answer,
        stats: { ...state.stats, typos: (state.stats.typos ?? 0) + 1 },
      }
    }

    case 'skip': {
      if (state.phase !== 'answering') return state
      return {
        ...state,
        ...markMissed(state, current),
        phase: 'feedback',
        lastAnswer: '',
        lastOutcome: 'skipped',
        lastPoints: 0,
        stats: {
          ...state.stats,
          attempts: state.stats.attempts + 1,
          skips: state.stats.skips + 1,
          streak: 0,
        },
      }
    }

    case 'hint': {
      if (state.phase !== 'answering' || state.hintsRevealed >= action.max) return state
      return {
        ...state,
        hintsRevealed: state.hintsRevealed + 1,
        stats: { ...state.stats, hintsUsed: state.stats.hintsUsed + 1 },
      }
    }

    case 'next': {
      if (state.phase !== 'feedback') return state
      const rest = state.queue.slice(1)
      let queue = rest
      let mastered = state.mastered
      if ((state.remaining[current] ?? 0) <= 0) {
        mastered = [...mastered, current]
      } else {
        const gap = state.lastOutcome === 'correct' ? REVIEW_GAP : RETRY_GAP
        const at = Math.min(gap, rest.length)
        queue = [...rest.slice(0, at), current, ...rest.slice(at)]
      }
      return {
        ...state,
        queue,
        mastered,
        phase: queue.length > 0 ? 'answering' : 'complete',
        cardSeq: state.cardSeq + 1,
        hintsRevealed: 0,
        lastAnswer: '',
        lastOutcome: null,
        lastPoints: 0,
        nearMiss: null,
        acceptedVia: undefined,
      }
    }
  }
}

function markMissed(state: SessionState, id: string): Pick<SessionState, 'remaining' | 'missed'> {
  return {
    remaining: { ...state.remaining, [id]: REQUIRED_AFTER_MISS },
    missed: state.missed.includes(id) ? state.missed : [...state.missed, id],
  }
}

/** True when the pending `next` will finish the session. */
export function isFinalCard(state: SessionState): boolean {
  return state.phase === 'feedback' && state.queue.length === 1 && (state.remaining[state.queue[0]] ?? 0) <= 0
}

/** Unseen words are drawn from the most frequent ones first; this widens the window for variety. */
const FREQUENCY_WINDOW = 3

/** Curated words count as most important; generated words by corpus frequency. */
const importance = (word: WordPair) => word.rank ?? 0

/**
 * Picks the words for a new session: up to half are past trouble words (most-missed first),
 * the rest prefer words never seen before — the most common ones first — then everything else.
 * Order is shuffled.
 */
export function createSession(
  level: CefrLevel,
  words: readonly WordPair[],
  history: MistakeHistory,
  size: number,
): SessionState {
  const count = size > 0 ? Math.min(size, words.length) : words.length
  const pool = shuffle(words)
  const trouble = pool
    .filter((w) => troubleScore(history[w.id]) > 0)
    .sort((a, b) => troubleScore(history[b.id]) - troubleScore(history[a.id]))
    .slice(0, Math.ceil(count / 2))
  const chosen = new Set(trouble.map((w) => w.id))
  const needed = count - trouble.length
  const unseenByFrequency = pool
    .filter((w) => !chosen.has(w.id) && !history[w.id])
    .sort((a, b) => importance(a) - importance(b))
  // Shuffle within a window of the most common unseen words, so sessions vary but stay useful.
  const unseen = [
    ...shuffle(unseenByFrequency.slice(0, needed * FREQUENCY_WINDOW)),
    ...unseenByFrequency.slice(needed * FREQUENCY_WINDOW),
  ]
  const seen = pool.filter((w) => !chosen.has(w.id) && history[w.id])
  const ids = shuffle([...trouble, ...unseen, ...seen].slice(0, count).map((w) => w.id))

  return {
    version: 1,
    level,
    wordIds: ids,
    queue: ids,
    remaining: Object.fromEntries(ids.map((id) => [id, 1])),
    mastered: [],
    missed: [],
    phase: ids.length > 0 ? 'answering' : 'complete',
    cardSeq: 0,
    hintsRevealed: 0,
    lastAnswer: '',
    lastOutcome: null,
    lastPoints: 0,
    nearMiss: null,
    stats: { attempts: 0, correct: 0, streak: 0, bestStreak: 0, hintsUsed: 0, skips: 0, score: 0, typos: 0 },
  }
}

const sessionKey = (level: CefrLevel) => `session:${level}`

export function saveSession(state: SessionState): void {
  writeStored(sessionKey(state.level), state)
}

export function clearSession(level: CefrLevel): void {
  removeStored(sessionKey(level))
}

/** Restores a saved session, or null if it is missing, outdated, or refers to unknown words. */
export function restoreSession(level: CefrLevel, knownIds: ReadonlySet<string>): SessionState | null {
  const saved = readStored<SessionState | null>(sessionKey(level), null)
  if (
    !saved ||
    saved.version !== 1 ||
    saved.level !== level ||
    !Array.isArray(saved.queue) ||
    !Array.isArray(saved.wordIds) ||
    !saved.wordIds.every((id) => knownIds.has(id)) ||
    (saved.queue.length === 0 && saved.phase !== 'complete')
  ) {
    return null
  }
  return saved
}
