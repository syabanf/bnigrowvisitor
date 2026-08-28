import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { TOUR_STEPS, type TourStep } from './steps'
import { cancelSpeech, isMuted, primeVoices, setMuted, speak } from '../lib/speech'

const DONE_KEY = 'quick-tour-done'
const PADDING = 8
const CARD_WIDTH = 320

interface Rect { top: number; left: number; width: number; height: number }

/**
 * A data-tour id may appear more than once. Non-zero size is not enough to pick
 * the right one: an element scrolled out of the nav's horizontal overflow still
 * reports a size, and spotlighting it would point at nothing the user can see.
 */
function findVisibleAnchor(anchor: string): HTMLElement | null {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${anchor}"]`))
  return (
    candidates.find(el => {
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return false
      if (getComputedStyle(el).visibility === 'hidden') return false
      return r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight
    }) ?? null
  )
}

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
  const navigate = useNavigate()
  const [steps, setSteps] = useState<TourStep[]>([])
  const [index, setIndex] = useState(0)
  const [active, setActive] = useState(false)
  const [rect, setRect] = useState<Rect | null>(null)
  const [muted, setMutedState] = useState(false)
  const [cardTop, setCardTop] = useState<number | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

  const step = steps[index]

  const start = useCallback(() => {
    // Steps whose anchor was never rendered for this role are dropped before
    // any of them is shown. Skipping at runtime instead would flash the doomed
    // step and leave the "x / N" counter quoting a total nobody reaches.
    const applicable = TOUR_STEPS.filter(
      s => !s.anchor || document.querySelector(`[data-tour="${s.anchor}"]`),
    )
    setSteps(applicable.length > 1 ? applicable : TOUR_STEPS)
    setIndex(0)
    setRect(null)
    setActive(true)
  }, [])

  const finish = useCallback(() => {
    cancelSpeech()
    setActive(false)
    setRect(null)
    try {
      localStorage.setItem(DONE_KEY, '1')
    } catch {
      // The tour simply offers itself again next time.
    }
  }, [])

  useEffect(() => {
    setMutedState(isMuted())
    primeVoices()
  }, [])

  // Anything can start the tour by dispatching this event.
  useEffect(() => {
    const onStart = () => start()
    window.addEventListener('bni:start-tour', onStart)
    return () => window.removeEventListener('bni:start-tour', onStart)
  }, [start])

  // Resolve the step: navigate if it names a route, then locate its anchor.
  useEffect(() => {
    if (!active || !step) return
    let cancelled = false

    const run = async () => {
      if (step.route && window.location.pathname !== step.route) {
        navigate(step.route)
      }
      if (!step.anchor) {
        if (!cancelled) setRect(null)
        return
      }

      const element = await waitForAnchor(step.anchor)
      if (cancelled) return
      if (!element) {
        setRect(null)
        return
      }

      element.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
      const box = element.getBoundingClientRect()
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height })
    }

    void run()
    return () => { cancelled = true }
  }, [active, step, navigate])

  // Narrate. Cancelling on change is what stops a fast clicker stacking voices.
  useEffect(() => {
    if (!active || !step || muted) return
    speak(`${step.title}. ${step.body}`)
    return () => cancelSpeech()
  }, [active, step, muted])

  // Keep the spotlight glued to its target while the page moves under it.
  useEffect(() => {
    if (!active || !step?.anchor) return
    const sync = () => {
      const el = findVisibleAnchor(step.anchor!)
      if (!el) return
      const box = el.getBoundingClientRect()
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
      if (event.key === 'Escape') finish()
      if (event.key === 'ArrowRight' && index < steps.length - 1) setIndex(i => i + 1)
      if (event.key === 'ArrowLeft' && index > 0) setIndex(i => i - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, index, steps.length, finish])

  // Measure the card rather than reserving a fixed height: a long step body
  // overflows any guess and pushes the buttons below the fold.
  useLayoutEffect(() => {
    if (!active) return
    const card = cardRef.current
    if (!card) return
    const height = card.getBoundingClientRect().height
    const current = parseFloat(String(card.style.top || '0'))
    const clamped = Math.max(16, Math.min(current, window.innerHeight - height - 16))
    setCardTop(Number.isFinite(clamped) ? clamped : 16)
  }, [active, index, rect])

  if (!active || !step) return null

  const isLast = index === steps.length - 1
  const vw = window.innerWidth
  const vh = window.innerHeight

  let cardStyle: React.CSSProperties
  if (!rect) {
    cardStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  } else {
    const below = rect.top + rect.height + 16
    const fitsBelow = below + 220 < vh
    cardStyle = {
      left: Math.min(Math.max(16, rect.left + rect.width / 2 - CARD_WIDTH / 2), vw - CARD_WIDTH - 16),
      top: fitsBelow ? below : Math.max(16, rect.top - 236),
    }
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Quick tour">
      {rect ? (
        // Dim everything, then punch a hole with an outsized box-shadow.
        <div
          className="tour__spot"
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
          }}
        />
      ) : (
        <div className="tour__dim" />
      )}

      <div
        ref={cardRef}
        className="tour__card"
        style={cardTop === null ? cardStyle : { ...cardStyle, top: cardTop }}
      >
        <div className="tour__head">
          <span className="tour__step">Langkah {index + 1} / {steps.length}</span>
          <div className="row-gap">
            <button
              className="btn btn--small"
              aria-label={muted ? 'Nyalakan narasi' : 'Matikan narasi'}
              onClick={() => {
                const next = !muted
                setMuted(next)
                setMutedState(next)
                if (next) cancelSpeech()
                else speak(`${step.title}. ${step.body}`)
              }}
            ><Icon name={muted ? 'volume-off' : 'volume-on'} /></button>
            <button className="btn btn--small" onClick={finish}>Lewati</button>
          </div>
        </div>

        <h3>{step.title}</h3>
        <p className="muted">{step.body}</p>

        <div className="tour__progress">
          {steps.map((s, i) => (
            <span key={s.id} className={i <= index ? 'on' : ''} />
          ))}
        </div>

        <div className="tour__actions">
          <button
            className="btn btn--small"
            disabled={index === 0}
            onClick={() => setIndex(i => Math.max(0, i - 1))}
          ><Icon name="arrow-left" /> Kembali</button>
          <button
            className="btn btn--primary btn--small"
            onClick={() => (isLast ? finish() : setIndex(i => i + 1))}
          >{isLast ? 'Selesai' : 'Lanjut'}{!isLast && <Icon name="arrow-right" />}</button>
        </div>
      </div>
    </div>
  )
}
