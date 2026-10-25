import type { WordPair } from '../types'
import type { Outcome } from '../session/session'
import { normalizeAnswer } from './text'

/** The English word to pronounce after answering: what the learner typed if it was accepted, else the main answer. */
export function answerToSpeak(
  word: WordPair,
  outcome: Outcome | null,
  lastAnswer: string,
  acceptedVia?: 'list' | 'dictionary',
): string {
  if (outcome === 'correct' && acceptedVia === 'dictionary') return lastAnswer.trim()
  return word.en.find((e) => normalizeAnswer(e) === normalizeAnswer(lastAnswer)) ?? word.en[0]
}
