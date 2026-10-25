import { useMemo, useState } from 'react'
import type { CefrLevel, WordPair } from '../types'
import { createSession, restoreSession, type SessionState } from '../session/session'
import { troubleScore, type MistakeHistory } from '../session/history'
import { PracticeSession } from './PracticeSession'
import { SessionSetup } from './SessionSetup'

interface SessionViewProps {
  level: CefrLevel
  words: WordPair[]
  history: MistakeHistory
  sessionSize: number
  soundOn: boolean
  onSessionSizeChange: (size: number) => void
  onResult: (word: WordPair, correct: boolean) => void
  onRestart: () => void
  onChangeLevel: (level: CefrLevel) => void
}

/**
 * Resumes the saved session for this level, or asks how many words to practise.
 * Mounted with a `key` per level/session, so it starts fresh after a restart.
 */
export function SessionView({
  level,
  words,
  history,
  sessionSize,
  onSessionSizeChange,
  ...practiceProps
}: SessionViewProps) {
  const [session, setSession] = useState<SessionState | null>(() =>
    restoreSession(level, new Set(words.map((w) => w.id))),
  )
  const troubleCount = useMemo(() => words.filter((w) => troubleScore(history[w.id]) > 0).length, [words, history])

  if (!session) {
    return (
      <SessionSetup
        level={level}
        available={words.length}
        curated={words.filter((w) => w.source === 'curated').length}
        initialSize={sessionSize}
        troubleCount={troubleCount}
        onStart={(size) => {
          onSessionSizeChange(size)
          setSession(createSession(level, words, history, size))
        }}
      />
    )
  }

  return <PracticeSession initial={session} words={words} {...practiceProps} />
}
