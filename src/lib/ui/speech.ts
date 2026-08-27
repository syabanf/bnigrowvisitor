// Narration for the quick tour.
//
// Two engines, in order of preference:
//   1. ElevenLabs via /api/tts — natural Indonesian, costs credits
//   2. the browser's speechSynthesis — free, offline, more robotic
//
// The fallback is not a corner case. ElevenLabs is unavailable whenever the key
// is unset, the plan disallows the configured voice, the quota runs out, or the
// device is offline — so every failure path lands on the browser voice rather
// than leaving a step silent.

import { isMuted } from './sound'

const PREFERRED_LANG = 'id-ID'

let cachedVoice: SpeechSynthesisVoice | null = null
let voicesReady = false

// Steps repeat verbatim as people move back and forth; re-fetching would spend
// credits for audio we already have. Object URLs live as long as the tab.
const audioCache = new Map<string, string>()
let currentAudio: HTMLAudioElement | null = null
let remoteAvailable: boolean | null = null
// Identifies the in-flight speak() call so a slow download can't play over a
// step the user has already moved past.
let activeToken: symbol | null = null

function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  // Prefer an on-device Indonesian voice: remote ones stall without a network.
  return (
    voices.find(voice => voice.lang.replace('_', '-') === PREFERRED_LANG && voice.localService) ||
    voices.find(voice => voice.lang.replace('_', '-') === PREFERRED_LANG) ||
    voices.find(voice => voice.lang.toLowerCase().startsWith('id')) ||
    null
  )
}

// Chrome populates the voice list asynchronously; without this the first
// utterance of a session gets the wrong voice.
export function primeVoices() {
  if (!speechSupported() || voicesReady) return
  const load = () => {
    const voice = pickVoice()
    if (voice) {
      cachedVoice = voice
      voicesReady = true
    }
  }
  load()
  if (!voicesReady) {
    window.speechSynthesis.onvoiceschanged = load
  }
}

function speakWithBrowser(text: string) {
  if (!speechSupported()) return
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = cachedVoice || pickVoice()
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = PREFERRED_LANG
    }
    utterance.rate = 1.02
    window.speechSynthesis.speak(utterance)
  } catch {
    // Narration is a nicety; never let it break the tour.
  }
}

async function fetchRemoteAudio(text: string): Promise<string | null> {
  const cached = audioCache.get(text)
  if (cached) return cached

  // One refusal is enough — don't retry a misconfigured or out-of-quota account
  // on every single step.
  if (remoteAvailable === false) return null

  try {
    const response = await fetch('/api/tts', {
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
    } catch {}
  }
}

export function speak(text: string) {
  const trimmed = text.trim()
  if (!trimmed || isMuted()) return

  cancelSpeech()

  const token = Symbol('speak')
  activeToken = token

  fetchRemoteAudio(trimmed).then(url => {
    if (activeToken !== token || isMuted()) return

    if (!url) {
      speakWithBrowser(trimmed)
      return
    }

    const audio = new Audio(url)
    currentAudio = audio
    audio.play().catch(() => {
      // Autoplay blocked, decode failure, etc. — the browser voice has a
      // different set of restrictions and often still works.
      if (activeToken === token) speakWithBrowser(trimmed)
    })
  })
}

export function isSpeechSupported(): boolean {
  return speechSupported()
}
