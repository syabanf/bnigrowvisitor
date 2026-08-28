/**
 * Narration for the quick tour.
 *
 * Two engines, in order: the server's ElevenLabs proxy for natural Indonesian,
 * and the browser's own speechSynthesis as the fallback. The fallback is not a
 * corner case — the provider is unavailable whenever the key is unset, the plan
 * disallows the configured voice, the quota runs out, or the device is offline.
 * Every one of those paths lands on the browser voice rather than silence.
 */

const MUTE_KEY = 'tour-narration-muted'
const PREFERRED_LANG = 'id-ID'

// Tour lines repeat verbatim as people step back and forth. Re-fetching would
// spend provider credits on audio already in hand.
const audioCache = new Map<string, string>()
let currentAudio: HTMLAudioElement | null = null
let remoteAvailable: boolean | null = null
// Identifies the in-flight call so a slow download cannot play over a step the
// user has already moved past.
let activeToken: symbol | null = null
let cachedVoice: SpeechSynthesisVoice | null = null

function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
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
  } catch {
    // Storage blocked: narration still works, only the preference is lost.
  }
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  // Prefer an on-device Indonesian voice: a remote one stalls without network.
  return (
    voices.find(v => v.lang.replace('_', '-') === PREFERRED_LANG && v.localService) ??
    voices.find(v => v.lang.replace('_', '-') === PREFERRED_LANG) ??
    voices.find(v => v.lang.toLowerCase().startsWith('id')) ??
    null
  )
}

/**
 * Chrome fills the voice list asynchronously; without this the first line of a
 * session gets the wrong voice.
 */
export function primeVoices() {
  if (!speechSupported()) return
  cachedVoice = pickVoice()
  if (!cachedVoice) {
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoice = pickVoice()
    }
  }
}

function speakWithBrowser(text: string) {
  if (!speechSupported()) return
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = cachedVoice ?? pickVoice()
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = PREFERRED_LANG
    }
    utterance.rate = 1.02
    window.speechSynthesis.speak(utterance)
  } catch {
    // Narration is a nicety; it must never break the tour.
  }
}

async function fetchRemoteAudio(text: string): Promise<string | null> {
  const cached = audioCache.get(text)
  if (cached) return cached

  // One refusal is enough. Retrying a misconfigured or out-of-quota account on
  // every step would add a failed round trip to each line of the tour.
  if (remoteAvailable === false) return null

  try {
    const response = await fetch('/api/narration', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      // 501 not configured, 402 plan, 429 quota — all permanent for this
      // session. A 5xx might be transient, so leave the door open.
      if (response.status < 500) remoteAvailable = false
      return null
    }

    const blob = await response.blob()
    if (!blob.size) return null

    const url = URL.createObjectURL(blob)
    audioCache.set(text, url)
    remoteAvailable = true
    return url
  } catch {
    return null
  }
}

export function cancelSpeech() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
  if (speechSupported()) {
    try {
      window.speechSynthesis.cancel()
    } catch {
      // The next speak() cancels again anyway.
    }
  }
}

export function speak(text: string) {
  const trimmed = text.trim()
  if (!trimmed || isMuted()) return

  cancelSpeech()

  const token = Symbol('speak')
  activeToken = token

  void fetchRemoteAudio(trimmed).then(url => {
    if (activeToken !== token || isMuted()) return

    if (!url) {
      speakWithBrowser(trimmed)
      return
    }

    const audio = new Audio(url)
    currentAudio = audio
    audio.play().catch(() => {
      // Autoplay blocked or decode failed. The browser voice has a different
      // set of restrictions and often still works.
      if (activeToken === token) speakWithBrowser(trimmed)
    })
  })
}
