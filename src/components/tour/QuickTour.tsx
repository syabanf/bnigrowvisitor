'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CHAPTER_TOUR, NATIONAL_TOUR, type TourStep } from './steps'
import { isMuted, playComplete, setMuted } from '@/lib/ui/sound'
import { cancelSpeech, primeVoices, speak } from '@/lib/ui/speech'

const DONE_KEY = 'quick-tour-done'
const PADDING = 8
const CARD_WIDTH = 320

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

// A data-tour id can appear more than once (sidebar and mobile tab bar carry the
// same ids); only the one actually on screen is a valid spotlight target.
//
// Non-zero size is not enough: on phones the sidebar is an off-canvas drawer at
// left:-243px, which still reports 230x40 and would win the lookup, putting the
// spotlight somewhere nobody can see. The rect has to actually intersect the
// viewport.
function findVisibleAnchor(anchor: string): HTMLElement | null {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${anchor}"]`))
  return (
    candidates.find(element => {
      const rect = element.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return false
      if (getComputedStyle(element).visibility === 'hidden') return false
      return (
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight
      )
    }) || null
  )
}

// Anchors appear late after a route change, so poll briefly before giving up.
function waitForAnchor(anchor: string, timeoutMs = 1600): Promise<HTMLElement | null> {
  return new Promise(resolve => {
    const started = performance.now()
    const tick = () => {
      const found = findVisibleAnchor(anchor)
      if (found) return resolve(found)
      if (performance.now() - started > timeoutMs) return resolve(null)
      requestAnimationFrame(tick)
    }
    tick()
  })
}

export default function QuickTour() {
  const router = useRouter()
  const [steps, setSteps] = useState<TourStep[]>([])
  const [index, setIndex] = useState(0)
  const [active, setActive] = useState(false)
  const [rect, setRect] = useState<Rect | null>(null)
  const [muted, setMutedState] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [cardTop, setCardTop] = useState<number | null>(null)

  const step = steps[index]

  useEffect(() => {
    setMutedState(isMuted())
    primeVoices()
  }, [])

  const start = useCallback(() => {
    let role = ''
    try {
      role = JSON.parse(localStorage.getItem('user') || 'null')?.role || ''
    } catch {}
    const isNational = role === 'national_admin' || role === 'admin'
    const source = isNational ? NATIONAL_TOUR : CHAPTER_TOUR

    // Drop steps whose anchor was never rendered for this role before showing
    // any of them. The runtime skip below still exists as a safety net, but on
    // its own it flashes the doomed step and leaves the "x / N" counter quoting
    // a total the user will never reach.
    const applicable = source.filter(
      item => !item.anchor || !!document.querySelector(`[data-tour="${item.anchor}"]`)
    )

    setSteps(applicable.length > 1 ? applicable : source)
    setIndex(0)
    setRect(null)
    setActive(true)
  }, [])

  const finish = useCallback((completed = false) => {
    cancelSpeech()
    if (completed) playComplete()
    window.dispatchEvent(new Event('bni:close-sidebar'))
    setActive(false)
    setRect(null)
    try {
      localStorage.setItem(DONE_KEY, '1')
    } catch {}
  }, [])

  const goNext = useCallback(() => {
    setIndex(current => current + 1)
  }, [])

  const goBack = useCallback(() => {
    setIndex(current => Math.max(0, current - 1))
  }, [])

  // Anything can start the tour by dispatching this event — the sidebar button
  // does, and so does the first-run effect below.
  useEffect(() => {
    const onStart = () => start()
    window.addEventListener('bni:start-tour', onStart)
    return () => window.removeEventListener('bni:start-tour', onStart)
  }, [start])

  // First run only. Delayed so the dashboard has painted before we point at it.
  useEffect(() => {
    let done = '1'
    try {
      done = localStorage.getItem(DONE_KEY) || ''
    } catch {}
    if (done) return

    const timer = setTimeout(() => start(), 1200)
    return () => clearTimeout(timer)
  }, [start])

  // Resolve the current step: navigate if needed, then locate its anchor.
  // A step whose anchor never shows up is skipped rather than rendered blind —
  // that's what keeps role-specific menu entries out of the wrong role's tour.
  useEffect(() => {
    if (!active || !step) return
    let cancelled = false

    const run = async () => {
      if (step.route && window.location.pathname !== step.route) {
        router.push(step.route)
      }

      if (!step.anchor) {
        if (!cancelled) {
          window.dispatchEvent(new Event('bni:close-sidebar'))
          setRect(null)
        }
        return
      }

      let element = await waitForAnchor(step.anchor)
      if (cancelled) return

      // Present in the DOM but off-screen means the sidebar drawer is closed —
      // open it and look again. Absent entirely means this role doesn't have
      // the feature, which is the case we actually want to skip.
      if (!element && document.querySelector(`[data-tour="${step.anchor}"]`)) {
        window.dispatchEvent(new Event('bni:open-sidebar'))
        element = await waitForAnchor(step.anchor)
        if (cancelled) return
      }

      if (!element) {
        // Skip forward; if this was the last step, just close.
        setIndex(current => (current + 1 < steps.length ? current + 1 : current))
        if (index + 1 >= steps.length) finish(true)
        return
      }

      element.scrollIntoView({ block: 'center', behavior: 'smooth' })
      const box = element.getBoundingClientRect()
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height })
    }

    run()
    return () => {
      cancelled = true
    }
  }, [active, step, index, steps.length, router, finish])

  // Narrate the step. Cancelling on change is what stops a fast clicker from
  // stacking three overlapping voices.
  useEffect(() => {
    if (!active || !step || muted) return
    speak(`${step.title}. ${step.body}`)
    return () => cancelSpeech()
  }, [active, step, muted])

  // Keep the spotlight glued to its target while the page moves under it.
  useEffect(() => {
    if (!active || !step?.anchor) return
    const sync = () => {
      const element = findVisibleAnchor(step.anchor!)
      if (!element) return
      const box = element.getBoundingClientRect()
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height })
    }
    window.addEventListener('scroll', sync, true)
    window.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
    }
  }, [active, step])

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(false)
      if (event.key === 'ArrowRight' && index < steps.length - 1) goNext()
      if (event.key === 'ArrowLeft' && index > 0) goBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, steps.length, index, finish, goNext, goBack])

  // Reserving a fixed height for the card was wrong: a long body overflows it
  // and the buttons end up below the fold. Measure the real card instead.
  useLayoutEffect(() => {
    if (!active) return
    const card = cardRef.current
    if (!card) return
    const height = card.getBoundingClientRect().height
    const maxTop = window.innerHeight - height - 16
    const current = parseFloat(String(card.style.top || '0'))
    const clamped = Math.max(16, Math.min(current, maxTop))
    setCardTop(Number.isFinite(clamped) ? clamped : 16)
  }, [active, index, rect])

  if (!active || !step) return null

  const isLast = index === steps.length - 1
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight

  // Card placement: beside a left-rail anchor when there's room, otherwise
  // below it, otherwise above. Centred when the step has no anchor at all.
  let cardStyle: React.CSSProperties
  if (!rect) {
    cardStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  } else {
    const roomRight = viewportWidth - (rect.left + rect.width)
    const placeBeside = roomRight > CARD_WIDTH + 32
    if (placeBeside) {
      cardStyle = {
        left: Math.min(rect.left + rect.width + 16, viewportWidth - CARD_WIDTH - 16),
        top: Math.min(Math.max(16, rect.top - 8), viewportHeight - 260),
      }
    } else {
      const below = rect.top + rect.height + 16
      const fitsBelow = below + 220 < viewportHeight
      cardStyle = {
        left: Math.min(Math.max(16, rect.left + rect.width / 2 - CARD_WIDTH / 2), viewportWidth - CARD_WIDTH - 16),
        top: fitsBelow ? below : Math.max(16, rect.top - 236),
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[2147483000]" role="dialog" aria-modal="true" aria-label="Quick tour">
      {/* Dim everything, then punch a hole with an outsized box-shadow. */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl transition-all duration-200"
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.62)',
            outline: '2px solid rgba(217, 23, 59, 0.9)',
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: 'rgba(15, 23, 42, 0.62)' }} />
      )}

      {/* Click-through guard: taps outside the card advance nothing, they just
          don't leak to the app underneath. */}
      <div className="absolute inset-0" onClick={event => event.stopPropagation()} />

      <div
        ref={cardRef}
        className="absolute w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.3)]"
        style={cardTop === null ? cardStyle : { ...cardStyle, top: cardTop }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">
            Langkah {index + 1} / {steps.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const next = !muted
                setMuted(next)
                setMutedState(next)
                if (next) cancelSpeech()
                else speak(`${step.title}. ${step.body}`)
              }}
              aria-label={muted ? 'Nyalakan narasi' : 'Matikan narasi'}
              title={muted ? 'Nyalakan narasi' : 'Matikan narasi'}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                {muted ? (
                  <path d="M22 9l-6 6M16 9l6 6" />
                ) : (
                  <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
                )}
              </svg>
            </button>
            <button
              onClick={() => finish(false)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              Lewati
            </button>
          </div>
        </div>

        <h3 className="mt-2 text-base font-bold text-gray-950">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{step.body}</p>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 gap-1">
            {steps.map((item, position) => (
              <span
                key={item.id}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  position <= index ? 'bg-red-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={goBack}
            disabled={index === 0}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Kembali
          </button>
          <button
            onClick={() => (isLast ? finish(true) : goNext())}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
          >
            {isLast ? 'Selesai' : 'Lanjut'}
          </button>
        </div>
      </div>
    </div>
  )
}
