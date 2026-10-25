import { createContext, useContext } from 'react'
import type { Accent } from '../services/dictionaryService'

export interface PronunciationSettings {
  /** Play the English recording once when the answer is revealed. */
  auto: boolean
  /** Preferred accent of the English recordings. */
  accent: Accent
  /** Online dictionary (Wiktionary) definitions and synonym acceptance. */
  dictionary: boolean
}

/** Pronunciation comes only from real native-speaker recordings — there is no synthetic voice. */
export interface Pronunciation {
  settings: PronunciationSettings
  /** Plays a recording of the English word; silent when none exists. */
  playEnglish: (text: string) => void
  /** Look the recording up in advance so playback starts instantly. */
  prefetchEnglish: (text: string) => void
  stop: () => void
}

const noop = () => {}

export const PronunciationContext = createContext<Pronunciation>({
  settings: { auto: false, accent: 'uk', dictionary: false },
  playEnglish: noop,
  prefetchEnglish: noop,
  stop: noop,
})

export function usePronunciation(): Pronunciation {
  return useContext(PronunciationContext)
}
