import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import Stack from '@mui/material/Stack'
import type { CefrLevel, WordPair } from '../types'
import { STREAK_MILESTONE, isFinalCard, saveSession, sessionReducer, type SessionState } from '../session/session'
import { sfx } from '../audio/sfx'
import { usePronunciation } from '../audio/pronunciationContext'
import { lookupCzechGlosses } from '../services/dictionaryService'
import { findNearMiss, isCorrectAnswer } from '../utils/text'
import { answerToSpeak } from '../utils/answerToSpeak'
import { FlashCard } from './FlashCard'
import { SessionComplete } from './SessionComplete'
import { StatsBar } from './StatsBar'
import { StreakBurst } from './StreakBurst'

/** How long a wrong-looking answer may wait for the online dictionary before being judged on the word list alone. */
const DICTIONARY_CHECK_TIMEOUT_MS = 2000

/** Small pause so the revealed answer doesn't talk over the feedback chime. */
const REVEAL_SPEECH_DELAY_MS = 350

const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
  Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))])

interface PracticeSessionProps {
  initial: SessionState
  words: WordPair[]
  soundOn: boolean
  onResult: (word: WordPair, correct: boolean) => void
  onRestart: () => void
  onChangeLevel: (level: CefrLevel) => void
}

/** Runs a started session. Every answer waits for Enter or a click before moving on. */
export function PracticeSession({ initial, words, soundOn, onResult, onRestart, onChangeLevel }: PracticeSessionProps) {
  const wordMap = useMemo(() => new Map(words.map((w) => [w.id, w])), [words])
  const [state, dispatch] = useReducer(sessionReducer, initial)
  const [burst, setBurst] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)
  const clearBurst = useCallback(() => setBurst(null), [])
  const { settings, playEnglish, prefetchEnglish, stop } = usePronunciation()
  const cardRef = useRef(state.cardSeq)
  const revealTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => saveSession(state), [state])
  useEffect(() => {
    cardRef.current = state.cardSeq
  }, [state.cardSeq])
  useEffect(
    () => () => {
      clearTimeout(revealTimer.current)
      stop()
    },
    [stop],
  )

  /** Plays the revealed answer's recording exactly once — called from the answer/skip handlers, never from an effect. */
  const sayAnswerOnce = (text: string) => {
    clearTimeout(revealTimer.current)
    if (!settings.auto) return
    revealTimer.current = setTimeout(() => playEnglish(text), REVEAL_SPEECH_DELAY_MS)
  }

  const word = wordMap.get(state.queue[0])
  const play = (sound: () => void) => soundOn && sound()

  // Warm the recording (and the dictionary) while the learner thinks, so playback and checking are instant.
  useEffect(() => {
    if (!word) return
    prefetchEnglish(word.en[0])
    if (settings.dictionary) void lookupCzechGlosses(word.cs)
  }, [word, settings.dictionary, prefetchEnglish])

  const next = useCallback(() => {
    clearTimeout(revealTimer.current)
    stop()
    if (isFinalCard(state) && soundOn) sfx.complete()
    dispatch({ type: 'next' })
  }, [state, soundOn, stop])

  // Enter also advances when focus has drifted outside the input (e.g. after clicking the page).
  useEffect(() => {
    if (state.phase !== 'feedback') return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key !== 'Enter' || event.repeat || target.closest('input, textarea, button, a')) return
      event.preventDefault()
      next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.phase, next])

  const submit = async (answer: string) => {
    if (!word || !answer.trim() || checking) return
    const card = state.cardSeq
    let accepted = word.en
    let via: 'list' | 'dictionary' = 'list'

    if (!isCorrectAnswer(answer, accepted) && settings.dictionary) {
      // Not in our list — Wiktionary may still know it as a valid meaning.
      setChecking(true)
      const glosses = await withTimeout(lookupCzechGlosses(word.cs), DICTIONARY_CHECK_TIMEOUT_MS)
      setChecking(false)
      if (cardRef.current !== card) return
      if (glosses && isCorrectAnswer(answer, glosses)) via = 'dictionary'
      if (glosses) accepted = [...word.en, ...glosses]
    }

    const correct = isCorrectAnswer(answer, accepted)
    if (!correct && !state.nearMiss && findNearMiss(answer, accepted)) {
      dispatch({ type: 'almost', answer })
      play(sfx.almost)
      return
    }

    dispatch({ type: 'answer', answer, correct, via })
    onResult(word, correct)
    sayAnswerOnce(answerToSpeak(word, correct ? 'correct' : 'incorrect', answer, via))

    if (!correct) return play(sfx.incorrect)
    const streak = state.hintsRevealed === 0 ? state.stats.streak + 1 : state.stats.streak
    play(() => sfx.correct(streak))
    if (state.hintsRevealed === 0 && streak % STREAK_MILESTONE === 0) {
      setBurst(streak)
      play(sfx.milestone)
    }
  }

  const skip = () => {
    if (!word) return
    dispatch({ type: 'skip' })
    onResult(word, false)
    play(sfx.skip)
    sayAnswerOnce(word.en[0])
  }

  const hint = (max: number) => {
    dispatch({ type: 'hint', max })
    play(sfx.hint)
  }

  return (
    <Stack spacing={3}>
      <StatsBar state={state} />
      {state.phase === 'complete' || !word ? (
        <SessionComplete state={state} wordMap={wordMap} onRestart={onRestart} onChangeLevel={onChangeLevel} />
      ) : (
        <FlashCard
          key={`card-${state.cardSeq}`}
          word={word}
          phase={state.phase}
          outcome={state.lastOutcome}
          lastAnswer={state.lastAnswer}
          lastPoints={state.lastPoints}
          hintsRevealed={state.hintsRevealed}
          isReview={state.missed.includes(word.id)}
          nearMiss={state.nearMiss ?? null}
          acceptedVia={state.acceptedVia}
          checking={checking}
          onSubmit={(answer) => void submit(answer)}
          onHint={hint}
          onSkip={skip}
          onNext={next}
        />
      )}
      {burst !== null && <StreakBurst key={`burst-${burst}`} streak={burst} onDone={clearBurst} />}
    </Stack>
  )
}
