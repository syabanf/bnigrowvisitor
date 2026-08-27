// Tiny synthesised UI sounds. Generated with the Web Audio API rather than
// shipped as audio files: no assets to cache, nothing to fetch offline, and the
// whole thing costs a few hundred bytes.

const MUTE_KEY = 'ui-sound-muted'

let context: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || (window as any).webkitAudioContext
  if (!Ctor) return null
  if (!context) {
    try {
      context = new Ctor()
    } catch {
      return null
    }
  }
  // Browsers start the context suspended until a user gesture; resuming here is
  // a no-op when it's already running and silently fails when there's been no
  // gesture yet, which is exactly the behaviour we want.
  if (context.state === 'suspended') context.resume().catch(() => {})
  return context
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {}
}

interface ToneOptions {
  frequency: number
  duration: number
  type?: OscillatorType
  gain?: number
  delay?: number
}

function tone({ frequency, duration, type = 'sine', gain = 0.06, delay = 0 }: ToneOptions) {
  const ctx = getContext()
  if (!ctx) return

  const startAt = ctx.currentTime + delay
  const oscillator = ctx.createOscillator()
  const envelope = ctx.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startAt)

  // Short attack, exponential release — a flat gain would click on both ends.
  envelope.gain.setValueAtTime(0.0001, startAt)
  envelope.gain.exponentialRampToValueAtTime(gain, startAt + 0.012)
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  oscillator.connect(envelope)
  envelope.connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration + 0.02)
}

function guard(play: () => void) {
  if (isMuted()) return
  try {
    play()
  } catch {
    // Audio is a nicety; never let it break an interaction.
  }
}

/** Moving forward: a soft, bright blip. */
export function playNext() {
  guard(() => tone({ frequency: 660, duration: 0.11, type: 'triangle' }))
}

/** Moving back: the same blip a fourth lower, so direction is audible. */
export function playBack() {
  guard(() => tone({ frequency: 440, duration: 0.11, type: 'triangle' }))
}

/** Dismissing without finishing: a short, flat low note. */
export function playDismiss() {
  guard(() => tone({ frequency: 320, duration: 0.13, type: 'sine', gain: 0.05 }))
}

/** Finishing: a rising three-note arpeggio. */
export function playComplete() {
  guard(() => {
    tone({ frequency: 523.25, duration: 0.13, type: 'triangle' })
    tone({ frequency: 659.25, duration: 0.13, type: 'triangle', delay: 0.1 })
    tone({ frequency: 783.99, duration: 0.24, type: 'triangle', delay: 0.2 })
  })
}
