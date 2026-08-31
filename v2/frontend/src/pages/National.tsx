import { useEffect, useState } from 'react'
import { api } from '../api/client'
import Table from '../components/Table'
import PageHeader from '../components/PageHeader'

interface ChapterRow {
  chapter_id: string
  chapter_name: string
  total_visitors: number
  need_follow_up: number
  became_member: number
  total_members: number
  active_members: number
  renewal_due_soon: number
  total_guests: number
  conversion_rate: number
  attendance_rate: number
}

interface NationalData {
  totals: {
    total_visitors: number
    total_members: number
    total_guests: number
    became_member: number
  }
  chapters: ChapterRow[]
}

export default function National() {
  const [data, setData] = useState<NationalData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<NationalData>('/dashboard/national')
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Gagal memuat data nasional.'))
  }, [])

  if (error) return <div className="alert">{error}</div>
  if (!data) return <p className="muted">Memuat…</p>

  return (
    <>
      <PageHeader
        title="Dashboard Nasional"
      />

      <div className="stat-grid">
        <div className="stat"><span className="stat__label">Chapter</span><span className="stat__value">{data.chapters.length}</span></div>
        <div className="stat"><span className="stat__label">Total Visitor</span><span className="stat__value">{data.totals.total_visitors}</span></div>
        <div className="stat"><span className="stat__label">Total Member</span><span className="stat__value">{data.totals.total_members}</span></div>
        <div className="stat"><span className="stat__label">Total Guest</span><span className="stat__value">{data.totals.total_guests}</span></div>
      </div>

      <section className="card">
        <h2>Per Chapter</h2>
        <Table
          rows={data.chapters}
          loading={false}
          rowKey={row => row.chapter_id}
          empty="Belum ada chapter aktif."
          columns={[
            { key: 'name', header: 'Chapter', render: r => <strong>{r.chapter_name}</strong> },
            { key: 'visitors', header: 'Visitor', render: r => r.total_visitors },
            { key: 'followup', header: 'Follow Up', render: r => r.need_follow_up },
            { key: 'members', header: 'Member', render: r => `${r.active_members} / ${r.total_members}` },
            { key: 'renewal', header: 'Renewal < 30hr', render: r => r.renewal_due_soon },
            { key: 'guests', header: 'Guest', render: r => r.total_guests },
            { key: 'conv', header: 'Konversi', render: r => `${r.conversion_rate.toFixed(0)}%` },
          ]}
        />
      </section>
    </>
  )
}
