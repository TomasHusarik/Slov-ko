// Tiny Web Audio synth for feedback sounds — no audio assets to ship or load.

type WebkitWindow = typeof window & { webkitAudioContext?: typeof AudioContext }

let context: AudioContext | null = null

function getContext(): AudioContext | null {
  if (!context) {
    const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
    if (!Ctor) return null
    context = new Ctor()
  }
  if (context.state === 'suspended') void context.resume()
  return context
}

function tone(freq: number, startOffset: number, duration: number, type: OscillatorType = 'sine', volume = 0.12) {
  const ctx = getContext()
  if (!ctx) return
  const start = ctx.currentTime + startOffset
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

const semitone = (base: number, steps: number) => base * 2 ** (steps / 12)

export const sfx = {
  /** Rising two-note chime; pitch climbs a little with the streak. */
  correct(streak: number) {
    const base = semitone(660, Math.min(streak, 12))
    tone(base, 0, 0.18, 'triangle')
    tone(semitone(base, 7), 0.08, 0.28, 'triangle')
  },
  incorrect() {
    tone(220, 0, 0.22, 'sawtooth', 0.05)
    tone(185, 0.12, 0.3, 'sawtooth', 0.05)
  },
  skip() {
    tone(440, 0, 0.12, 'sine', 0.06)
    tone(330, 0.1, 0.18, 'sine', 0.06)
  },
  /** Neutral "hmm?" for a near-miss typo: not a failure sound. */
  almost() {
    tone(587, 0, 0.12, 'sine', 0.07)
    tone(523, 0.1, 0.2, 'sine', 0.07)
  },
  hint() {
    tone(880, 0, 0.08, 'sine', 0.05)
  },
  milestone() {
    ;[0, 4, 7, 12].forEach((step, i) => tone(semitone(784, step), i * 0.07, 0.35, 'triangle', 0.1))
  },
  complete() {
    ;[0, 4, 7, 12, 16].forEach((step, i) => tone(semitone(523, step), i * 0.11, 0.5, 'triangle', 0.1))
  },
}
