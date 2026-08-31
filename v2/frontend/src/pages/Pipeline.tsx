import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import Skeleton from '../components/Skeleton'
import Icon from '../components/Icon'
import { STATUS_LABEL, type ListResult, type Visitor, type VisitorStatus } from '../api/types'

// The funnel, in order. Terminal states sit at the end so the board reads left
// to right as progress.
const COLUMNS: VisitorStatus[] = [
  'new', 'followup', 'confirmed', 'attended', 'interview', 'member',
]

const TONE: Partial<Record<VisitorStatus, string>> = {
  new: 'col--blue',
  followup: 'col--amber',
  confirmed: 'col--teal',
  attended: 'col--green',
  interview: 'col--violet',
  member: 'col--red',
}

export default function Pipeline() {
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // The board shows the whole funnel at once, so it asks for the maximum
      // page rather than paginating — a chapter with more than this has
      // outgrown a kanban view anyway.
      const res = await api.get<ListResult<Visitor>>('/visitors?limit=200')
      setVisitors(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat pipeline.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const move = async (visitor: Visitor, direction: 1 | -1) => {
    const index = COLUMNS.indexOf(visitor.status)
    const next = COLUMNS[index + direction]
    if (!next) return

    // Optimistic, then reconciled by the reload — the card moves the instant
    // it is clicked instead of after a round trip.
    setVisitors(prev => prev.map(v => (v.id === visitor.id ? { ...v, status: next } : v)))
    try {
      await api.patch(`/visitors/${visitor.id}`, { ...visitor, status: next })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memindahkan visitor.')
      void load()
    }
  }

  const total = visitors.length

  return (
    <>
      <h1>Pipeline</h1>
      <p className="muted small">
        Perjalanan visitor dari mendaftar sampai jadi member. Geser kartu dengan tombol panah.
      </p>

      {error && <div className="alert">{error}</div>}
      {loading ? (
        <Skeleton rows={4} columns="1fr 1fr 1fr 1fr" />
      ) : (
        <div className="board">
          {COLUMNS.map(status => {
            const cards = visitors.filter(v => v.status === status)
            const share = total > 0 ? Math.round((cards.length / total) * 100) : 0
            return (
              <section key={status} className={`col ${TONE[status] ?? ''}`}>
                <header className="col__head">
                  <span>{STATUS_LABEL[status]}</span>
                  <span className="col__count">{cards.length} · {share}%</span>
                </header>
                <div className="col__body">
                  {cards.length === 0 ? (
                    <p className="muted small">Kosong</p>
                  ) : (
                    cards.map(v => (
                      <article key={v.id} className="card-mini">
                        <strong>{v.name}</strong>
                        {v.business_field && <div className="muted small">{v.business_field}</div>}
                        <div className="muted small">{v.phone}</div>
                        {v.pic_name && <div className="muted small">PIC: {v.pic_name}</div>}
                        <div className="card-mini__actions">
                          <button
                            className="btn btn--small"
                            disabled={COLUMNS.indexOf(status) === 0}
                            aria-label={`Mundurkan ${v.name}`}
                            onClick={() => void move(v, -1)}
                          ><Icon name="arrow-left" /></button>
                          <button
                            className="btn btn--small"
                            disabled={COLUMNS.indexOf(status) === COLUMNS.length - 1}
                            aria-label={`Majukan ${v.name}`}
                            onClick={() => void move(v, 1)}
                          ><Icon name="arrow-right" /></button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
