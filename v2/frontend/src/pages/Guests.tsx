import { useState } from 'react'
import Table from '../components/Table'
import Pagination from '../components/Pagination'
import { useResource } from '../hooks/useResource'
import PageHeader from '../components/PageHeader'
import { useMeetingOptions } from '../hooks/useOptions'

interface Guest {
  id: string
  name: string
  gender?: string
  business_field?: string
  company?: string
  phone?: string
  referral_name?: string
  meeting_name?: string
  visit_date?: string
  meeting_format?: string
  source_type?: string
}

export default function Guests() {
  const [search, setSearch] = useState('')
  const [meetingId, setMeetingId] = useState('')
  const meetings = useMeetingOptions()
  const { items, total, loading, error, page, setPage, pageSize, setPageSize } = useResource<Guest>('/guests', { q: search, meetingId })

  return (
    <>
      <PageHeader title="Guest" count={`${total.toLocaleString('id-ID')} guest`} />
      <p className="muted small">
        Tamu yang hadir tanpa lewat alur visitor — dipisah supaya statistik konversi visitor tetap bersih.
      </p>

      <div className="filters">
        <input
          type="search" value={search} placeholder="Cari nama, telepon, perusahaan…"
          onChange={e => setSearch(e.target.value)}
        />
              <select value={meetingId} onChange={e => setMeetingId(e.target.value)} aria-label="Filter meeting">
          <option value="">Semua Meeting</option>
          {meetings.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
</div>

      {error && <div className="alert">{error}</div>}

      <Table
        rows={items}
        loading={loading}
        rowKey={g => g.id}
        empty="Belum ada guest."
        columns={[
          {
            key: 'name', header: 'Nama',
            render: g => (
              <>
                <strong>{g.name}</strong>
                {g.company && <div className="muted small">{g.company}</div>}
              </>
            ),
          },
          { key: 'contact', header: 'Telepon', render: g => g.phone || '—' },
          { key: 'field', header: 'Bidang Usaha', render: g => g.business_field || '—' },
          { key: 'referral', header: 'Diajak Oleh', render: g => g.referral_name || '—' },
          { key: 'meeting', header: 'Meeting', render: g => g.meeting_name || '—' },
          {
            key: 'format', header: 'Format',
            render: g => (g.meeting_format ? <span className="pill">{g.meeting_format}</span> : '—'),
          },
        ]}
      />

      <Pagination
        page={page} pageSize={pageSize} total={total} shown={items.length}
        onPage={setPage} onPageSize={setPageSize}
      />
    </>
  )
}
