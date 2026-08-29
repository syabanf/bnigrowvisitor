import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import Icon from './Icon'

interface Turn {
  role: 'user' | 'assistant'
  content: string
  /** Set on assistant turns so the UI can say where the answer came from. */
  source?: 'model' | 'data'
  warning?: string
}

interface AnswerResponse {
  answer: string
  source: 'model' | 'data'
  warning?: string
}

interface StatusResponse {
  configured: boolean
  name: string
}

const STARTERS = [
  'Ringkas kondisi chapter',
  'Siapa yang perlu follow up?',
  'Berapa konversi kita?',
  'Member mana yang perlu perpanjangan?',
]

export default function Assistant() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetched once the panel is first opened rather than on mount: an assistant
  // nobody clicks should not cost a request on every page load.
  useEffect(() => {
    if (!open || status) return
    api.get<StatusResponse>('/assistant/status').then(setStatus).catch(() => {})
  }, [open, status])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Pin to the newest message. Without this the panel keeps showing the top of
  // the conversation while answers pile up out of sight below.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, busy])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const send = async (question: string) => {
    const text = question.trim()
    if (!text || busy) return

    setDraft('')
    setError('')
    setBusy(true)
    // Captured before the state update so the request carries the history as it
    // was, not including the question being asked — the server appends that.
    const history = turns.map(t => ({ role: t.role, content: t.content }))
    setTurns(prev => [...prev, { role: 'user', content: text }])

    try {
      const res = await api.post<AnswerResponse>('/assistant', { question: text, history })
      setTurns(prev => [...prev, {
        role: 'assistant', content: res.answer, source: res.source, warning: res.warning,
      }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Asisten sedang bermasalah.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button" className="assistant-bubble" onClick={() => setOpen(true)}
        data-tour="assistant"
      >
        <Icon name="message" size={1.15} label="Buka asisten" />
      </button>
    )
  }

  return (
    <section className="assistant" aria-label="Asisten">
      <header className="assistant__head">
        <span className="assistant__title">
          <Icon name="message" /> {status?.name ?? 'Asisten'}
        </span>
        <button
          type="button" className="btn btn--ghost btn--icon"
          onClick={() => setOpen(false)}
        >
          <Icon name="close" label="Tutup asisten" />
        </button>
      </header>

      <div className="assistant__log" ref={logRef}>
        {turns.length === 0 && (
          <div className="assistant__intro">
            <p className="muted small">
              Tanya apa saja tentang data chapter ini. Jawabannya dihitung dari angka
              yang kamu punya, bukan dari tebakan.
            </p>
            {status && !status.configured && (
              // Said up front, not discovered from the first reply: the
              // difference changes what is worth asking.
              <p className="assistant__note">
                <Icon name="alert" size={0.9} /> Belum ada model AI yang dikonfigurasi.
                Pertanyaan angka tetap dijawab; pertanyaan bebas belum bisa.
              </p>
            )}
            <div className="assistant__starters">
              {STARTERS.map(s => (
                <button key={s} type="button" className="chip" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className={`bubble bubble--${turn.role}`}>
            {turn.content}
            {turn.warning && (
              <span className="assistant__note">
                <Icon name="alert" size={0.85} /> {turn.warning}
              </span>
            )}
            {turn.role === 'assistant' && turn.source === 'data' && !turn.warning && (
              <span className="assistant__tag">dari data</span>
            )}
          </div>
        ))}

        {busy && <div className="bubble bubble--assistant muted">Menghitung…</div>}
        {error && <div className="alert">{error}</div>}
      </div>

      <form
        className="assistant__form"
        onSubmit={e => { e.preventDefault(); void send(draft) }}
      >
        <input
          ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
          placeholder="Tanya soal visitor, member, konversi…" aria-label="Pertanyaan"
        />
        <button type="submit" className="btn btn--primary btn--icon" disabled={busy || !draft.trim()}>
          <Icon name="arrow-right" label="Kirim" />
        </button>
      </form>
    </section>
  )
}
