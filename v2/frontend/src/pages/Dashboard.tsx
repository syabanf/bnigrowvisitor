import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import Icon, { type IconName } from '../components/Icon'
import MiniChart from '../components/MiniChart'
import PageHeader from '../components/PageHeader'
import Skeleton from '../components/Skeleton'
import { formatDate } from '../lib/format'

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

interface NameCount { name: string; count: number }

interface Insight {
  focus: { need_follow_up: number; unassigned: number; data_quality: number; ready_wa: number }
  ready_wa: { id: string; name: string; phone: string; pic_name: string }[]
  funnel: { label: string; count: number; percent: number }[]
  meeting_trend: { id: string; title: string; date: string; count: number }[]
  top_industry: NameCount[]
  top_referrer: NameCount[]
}

interface DashboardData {
  stats: ChapterStats
  insight: Insight
  conversion_rate: number
  attendance_rate: number
}

/**
 * The four queues that open the dashboard. Each is work waiting to be done, not
 * a statistic, which is why each one links to the screen where it gets done.
 */
const FOCUS: { key: keyof Insight['focus']; label: string; hint: string; tone: string; icon: IconName; to: string }[] = [
  { key: 'need_follow_up', label: 'Today Focus', hint: 'Perlu follow-up', tone: 'focus--red', icon: 'clock', to: '/visitors?status=followup' },
  { key: 'unassigned', label: 'Belum Assigned', hint: 'Belum ada PIC', tone: 'focus--purple', icon: 'user', to: '/visitors' },
  { key: 'data_quality', label: 'Data Quality', hint: 'Butuh dilengkapi', tone: 'focus--amber', icon: 'alert', to: '/visitors' },
  { key: 'ready_wa', label: 'Siap Kirim WA', hint: 'Siap dikirim WA', tone: 'focus--green', icon: 'message', to: '/wa-blast' },
]

function Bars({ rows, empty }: { rows: NameCount[]; empty: string }) {
  if (rows.length === 0) return <p className="muted small">{empty}</p>
  // Relative to the largest row, so a chapter with small numbers still gets a
  // readable shape instead of five slivers.
  const max = Math.max(...rows.map(r => r.count), 1)
  return (
    <div className="rankbars">
      {rows.map(r => (
        <div className="rankbar" key={r.name}>
          <span className="rankbar__label" title={r.name}>{r.name}</span>
          <span className="rankbar__track">
            <span className="rankbar__fill" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="rankbar__count">{r.count}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<DashboardData>('/dashboard/chapter')
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Gagal memuat dashboard.'))
  }, [])

  if (error) return <><PageHeader title="Chapter Dashboard" /><div className="alert">{error}</div></>
  if (!data) return <><PageHeader title="Chapter Dashboard" /><Skeleton rows={4} columns="1fr 1fr 1fr 1fr" /></>

  const { stats, insight } = data
  const trend = insight.meeting_trend.map(m => ({ label: formatDate(m.date).replace(/ \d{4}$/, ''), value: m.count }))
  const trendTotal = insight.meeting_trend.reduce((sum, m) => sum + m.count, 0)

  // Two columns, filled down the first then the second, which is how the
  // reference reads and keeps the longest bars together.
  const half = Math.ceil(insight.top_referrer.length / 2)
  const referrerColumns = [insight.top_referrer.slice(0, half), insight.top_referrer.slice(half)]

  return (
    <>
      <PageHeader
        title="Chapter Dashboard"
        actions={<Link to="/visitors" className="btn btn--primary"><Icon name="plus" /> Tambah Visitor</Link>}
      />

      <div className="focus">
        {FOCUS.map(f => (
          <Link key={f.key} to={f.to} className={`focus__card ${f.tone}`}>
            <span className="focus__label"><Icon name={f.icon} size={0.8} /> {f.label}</span>
            <span className="focus__value">{insight.focus[f.key]}</span>
            <span className="focus__hint">{f.hint}</span>
          </Link>
        ))}
      </div>

      <section className="card">
        <div className="card__head">
          <h2>List Siap Kirim WA</h2>
          <Link to="/wa-blast" className="card__link">Buka WA Blast <Icon name="arrow-right" size={0.85} /></Link>
        </div>
        {insight.ready_wa.length === 0 ? (
          <p className="muted small">Belum ada visitor baru yang siap dikirim WA.</p>
        ) : (
          <div className="wa-grid">
            {insight.ready_wa.map(v => (
              <div className="wa-card" key={v.id}>
                <strong>{v.name}</strong>
                <span className="muted small">{v.phone}</span>
                <span className="wa-card__pic">PIC: {v.pic_name || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card__head">
          <div>
            <h2>Conversion Funnel</h2>
            <p className="muted small">Alur visitor dari masuk sampai jadi member.</p>
          </div>
          <span className="pill pill--good">{stats.became_member} member</span>
        </div>
        <div className="funnel-row">
          {insight.funnel.map((stage, i) => (
            <div className="funnel-step" key={stage.label}>
              <span className="funnel-step__head">
                <span className="funnel-step__label">{i + 1}. {stage.label.toUpperCase()}</span>
                <span className="funnel-step__pct">{stage.percent.toFixed(0)}%</span>
              </span>
              <span className="funnel-step__count">{stage.count}</span>
              <span className="funnel-step__track">
                <span className={`funnel-step__fill funnel-step__fill--${i}`} style={{ width: `${stage.percent}%` }} />
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="split">
        <section className="card">
          <div className="card__head">
            <div>
              <h2>Visitor per Weekly Meeting</h2>
              <p className="muted small">Jumlah visitor per sesi meeting.</p>
            </div>
            <span className="count-chip">{trendTotal} total</span>
          </div>
          <MiniChart points={trend} />
        </section>

        <section className="card">
          <h2>Top Industri</h2>
          <Bars rows={insight.top_industry} empty="Belum ada data bidang usaha." />
        </section>
      </div>

      <section className="card">
        <h2><Icon name="chart" size={0.95} /> Top Visitor &amp; Guest Brought</h2>
        <p className="muted small">
          Siapa yang paling banyak membawa orang. Visitor yang tidak hadir tidak dihitung.
        </p>
        <div className="split">
          {referrerColumns.map((col, i) => (
            <Bars key={i} rows={col} empty={i === 0 ? 'Belum ada data.' : ''} />
          ))}
        </div>
      </section>

      <div className="stat-grid">
        <div className="stat"><span className="stat__label">Total Visitor</span><span className="stat__value">{stats.total_visitors}</span></div>
        <div className="stat"><span className="stat__label">Konversi</span><span className="stat__value">{data.conversion_rate.toFixed(1)}%</span></div>
        <div className="stat"><span className="stat__label">Kehadiran</span><span className="stat__value">{data.attendance_rate.toFixed(1)}%</span></div>
        <div className="stat"><span className="stat__label">Member Aktif</span><span className="stat__value">{stats.active_members} / {stats.total_members}</span></div>
        <div className="stat"><span className="stat__label">Guest</span><span className="stat__value">{stats.total_guests}</span></div>
        <div className="stat"><span className="stat__label">Meeting</span><span className="stat__value">{stats.total_meetings}</span></div>
      </div>
    </>
  )
}
