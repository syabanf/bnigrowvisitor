import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { STATUS_LABEL, type VisitorStatus } from '../api/types'
import Icon, { type IconName } from '../components/Icon'
import PageHeader from '../components/PageHeader'
import Skeleton from '../components/Skeleton'

interface ChapterStats {
  total_visitors: number
  need_follow_up: number
  unassigned: number
  confirmed: number
  attended: number
  became_member: number
  total_members: number
  active_members: number
  renewal_due_soon: number
  total_guests: number
  total_meetings: number
}

interface DashboardData {
  stats: ChapterStats
  status_chart: { status: string; count: number }[]
  conversion_rate: number
  attendance_rate: number
}

function Stat({ label, value, hint, tone, icon }: {
  label: string; value: string | number; hint?: string; tone?: string; icon?: IconName
}) {
  return (
    <div className="stat">
      <span className="stat__label">{icon && <Icon name={icon} size={0.85} />}{label}</span>
      <span className={`stat__value${tone ? ` stat__value--${tone}` : ''}`}>{value}</span>
      {hint && <span className="muted small">{hint}</span>}
    </div>
  )
}

// The pipeline in the order it happens. The chart used to sort by count, which
// made the shape unreadable — the stages only mean anything in sequence.
//
// Ordered, but not a conversion funnel. These are current statuses, and a
// visitor occupies exactly one: comparing two buckets cannot say how many moved
// between them. A first version did, and produced "110% lanjut", which is the
// giveaway. Real conversion needs the history of transitions, which is not
// recorded.
const FUNNEL: VisitorStatus[] = ['new', 'followup', 'confirmed', 'attended', 'member']

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<DashboardData>('/dashboard/chapter')
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Gagal memuat dashboard.'))
  }, [])

  if (error) return <><PageHeader title="Dashboard Chapter" /><div className="alert">{error}</div></>
  if (!data) return <><PageHeader title="Dashboard Chapter" /><Skeleton rows={3} columns="1fr 1fr 1fr" /></>

  const { stats } = data
  const counts = new Map(data.status_chart.map(row => [row.status, row.count]))
  // Relative to the widest stage, not to the total: with a healthy funnel every
  // later stage would otherwise be a sliver too short to read.
  const widest = Math.max(...FUNNEL.map(k => counts.get(k) ?? 0), 1)

  // What needs doing today, separated from what merely happened. These are the
  // only figures on the page that imply an action, and they were sitting in the
  // same uniform grid as the meeting count.
  const actions = [
    { label: 'Perlu Follow Up', value: stats.need_follow_up, icon: 'clock' as const, to: '/visitors', hint: 'status baru / follow up' },
    { label: 'Belum Ada PIC', value: stats.unassigned, icon: 'user' as const, to: '/visitors', hint: 'visitor tanpa pemilik' },
    { label: 'Renewal < 30 Hari', value: stats.renewal_due_soon, icon: 'alert' as const, to: '/members', hint: 'member perlu diperpanjang' },
  ]

  return (
    <>
      <PageHeader
        title="Dashboard Chapter"
      />

      {/* Needs attention, given its own weight. A count of zero is good news
          and says so, rather than looking like a broken card. */}
      <div className="attention">
        {actions.map(a => (
          <Link key={a.label} to={a.to} className={`attention__card${a.value > 0 ? ' attention__card--due' : ''}`}>
            <span className="attention__label"><Icon name={a.icon} size={0.9} /> {a.label}</span>
            <span className="attention__value">{a.value}</span>
            <span className="attention__hint">{a.value > 0 ? a.hint : 'tidak ada yang tertunda'}</span>
            <Icon name="chevron-right" size={0.9} className="attention__go" />
          </Link>
        ))}
      </div>

      <section className="card">
        <h2>Tahap Visitor</h2>
        <p className="muted small">
          Berapa visitor yang <em>sedang</em> berada di tiap tahap, diurutkan sesuai
          alurnya. Bukan corong konversi: seorang visitor hanya menempati satu tahap,
          jadi membandingkan dua ember tidak memberi tahu berapa yang lanjut.
          Persentasenya terhadap seluruh visitor, dan tidak berjumlah 100 —
          tahap Tidak Hadir, Interview, dan Tidak Lanjut tidak ditampilkan di sini.
        </p>
        <div className="funnel">
          {FUNNEL.map(key => {
            const count = counts.get(key) ?? 0
            return (
              <div className="funnel__stage" key={key}>
                <div className="funnel__row">
                  <span className="funnel__label">{STATUS_LABEL[key]}</span>
                  <span className="funnel__track">
                    <span className="funnel__fill" style={{ width: `${(count / widest) * 100}%` }} />
                  </span>
                  <span className="funnel__count">{count}</span>
                  {/* Share of all visitors — true of a snapshot, unlike a
                      stage-to-stage rate. */}
                  <span className="funnel__share">
                    {stats.total_visitors > 0
                      ? `${Math.round((count / stats.total_visitors) * 100)}%`
                      : '—'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="stat-grid">
        <Stat label="Total Visitor" value={stats.total_visitors} icon="users" />
        <Stat label="Konversi" value={`${data.conversion_rate.toFixed(1)}%`} hint="visitor jadi member" icon="chart" />
        <Stat label="Kehadiran" value={`${data.attendance_rate.toFixed(1)}%`} hint="dari yang konfirmasi" icon="check" />
        <Stat label="Member Aktif" value={`${stats.active_members} / ${stats.total_members}`} icon="user" />
        <Stat label="Guest" value={stats.total_guests} icon="users" />
        <Stat label="Meeting" value={stats.total_meetings} icon="calendar" />
      </div>

    </>
  )
}
