import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { lookupRecordings, peekCached, pickRecording, recordingsKey, type Recording } from '../services/dictionaryService'
import { PronunciationContext, type Pronunciation, type PronunciationSettings } from './pronunciationContext'

export function PronunciationProvider({ settings, children }: { settings: PronunciationSettings; children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const tokenRef = useRef(0)
  // Callbacks read settings through a ref so their identity never changes: consumers can't
  // accidentally re-trigger playback just because settings updated.
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  const stop = useCallback(() => {
    tokenRef.current++
    audioRef.current?.pause()
  }, [])

  const playEnglish = useCallback(
    (text: string) => {
      stop()
      const token = tokenRef.current
      const play = (recordings: Recording[] | null) => {
        if (token !== tokenRef.current) return
        const recording = recordings && pickRecording(recordings, settingsRef.current.accent)
        if (!recording) return
        const audio = (audioRef.current ??= new Audio())
        audio.src = recording.url
        audio.currentTime = 0
        void audio.play().catch(() => {})
      }
      // Already looked up (normally prefetched): play synchronously, inside the click's user gesture.
      const known = peekCached<Recording[]>(recordingsKey(text))
      if (known !== undefined) play(known)
      else void lookupRecordings(text).then(play)
    },
    [stop],
  )

  const prefetchEnglish = useCallback((text: string) => void lookupRecordings(text), [])

  const value = useMemo<Pronunciation>(
    () => ({ settings, playEnglish, prefetchEnglish, stop }),
    [settings, playEnglish, prefetchEnglish, stop],
  )

  return <PronunciationContext.Provider value={value}>{children}</PronunciationContext.Provider>
}
