import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { STATUS_LABEL, type VisitorStatus } from '../api/types'
import PageHeader from '../components/PageHeader'

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

function Stat({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: string }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className={`stat__value${tone ? ` stat__value--${tone}` : ''}`}>{value}</span>
      {hint && <span className="muted small">{hint}</span>}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<DashboardData>('/dashboard/chapter')
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Gagal memuat dashboard.'))
  }, [])

  if (error) return <div className="alert">{error}</div>
  if (!data) return <p className="muted">Memuat…</p>

  const { stats } = data
  const maxCount = Math.max(...data.status_chart.map(s => s.count), 1)

  return (
    <>
      <PageHeader
        title="Dashboard Chapter"
      />

      <div className="stat-grid">
        <Stat label="Total Visitor" value={stats.total_visitors} />
        <Stat label="Perlu Follow Up" value={stats.need_follow_up} tone="warn" hint="status baru / follow up" />
        <Stat label="Belum Ada PIC" value={stats.unassigned} tone="warn" />
        <Stat label="Jadi Member" value={stats.became_member} tone="good" />
        <Stat label="Konversi" value={`${data.conversion_rate.toFixed(1)}%`} hint="visitor jadi member" />
        <Stat label="Kehadiran" value={`${data.attendance_rate.toFixed(1)}%`} hint="dari yang konfirmasi" />
        <Stat label="Member Aktif" value={`${stats.active_members} / ${stats.total_members}`} />
        <Stat label="Renewal < 30 Hari" value={stats.renewal_due_soon} tone={stats.renewal_due_soon > 0 ? 'warn' : undefined} />
        <Stat label="Guest" value={stats.total_guests} />
        <Stat label="Meeting" value={stats.total_meetings} />
      </div>

      <section className="card">
        <h2>Sebaran Status Visitor</h2>
        {data.status_chart.length === 0 ? (
          <p className="muted">Belum ada visitor.</p>
        ) : (
          <div className="bars">
            {data.status_chart.map(row => (
              <div key={row.status} className="bar">
                <span className="bar__label">
                  {STATUS_LABEL[row.status as VisitorStatus] ?? row.status}
                </span>
                {/* Width is relative to the largest bucket so the shape stays
                    readable even when every count is small. */}
                <span className="bar__track">
                  <span className="bar__fill" style={{ width: `${(row.count / maxCount) * 100}%` }} />
                </span>
                <span className="bar__count">{row.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
