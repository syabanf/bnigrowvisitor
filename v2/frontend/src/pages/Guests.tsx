import { useState } from 'react'
import Table from '../components/Table'
import Pagination from '../components/Pagination'
import { useResource } from '../hooks/useResource'

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
  const { items, total, loading, error, page, setPage, pageSize, setPageSize } = useResource<Guest>('/guests', { q: search })

  return (
    <>
      <h1>Guest</h1>
      <p className="muted small">
        Tamu yang hadir tanpa lewat alur visitor — dipisah supaya statistik konversi visitor tetap bersih.
      </p>

      <div className="filters">
        <input
          type="search" value={search} placeholder="Cari nama, telepon, perusahaan…"
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="alert">{error}</div>}
      <p className="muted small">Menampilkan {items.length} dari {total} guest</p>

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
