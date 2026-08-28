import { useState } from 'react'
import { api } from '../api/client'
import Table from '../components/Table'
import { useResource } from '../hooks/useResource'

interface Member {
  id: string
  name: string
  phone?: string
  email?: string
  business_field?: string
  company?: string
  renewal_date?: string
  status: 'active' | 'inactive' | 'suspended'
}

const STATUS_LABEL: Record<Member['status'], string> = {
  active: 'Aktif',
  inactive: 'Tidak Aktif',
  suspended: 'Suspended',
}

function renewalTone(date?: string): string {
  if (!date) return ''
  const days = (new Date(date).getTime() - Date.now()) / 86_400_000
  if (days < 0) return 'pill--danger'
  if (days < 30) return 'pill--warn'
  return ''
}

export default function Members() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const { items, total, loading, error, reload, setError } =
    useResource<Member>('/members', { q: search, status })

  const changeStatus = async (member: Member, next: Member['status']) => {
    try {
      await api.patch(`/members/${member.id}`, { ...member, status: next })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status.')
    }
  }

  return (
    <>
      <h1>Member</h1>

      <div className="filters">
        <input
          type="search" value={search} placeholder="Cari nama, telepon, email, perusahaan…"
          onChange={e => setSearch(e.target.value)}
        />
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Semua Status</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {error && <div className="alert">{error}</div>}
      <p className="muted small">Menampilkan {items.length} dari {total} member</p>

      <Table
        rows={items}
        loading={loading}
        rowKey={m => m.id}
        empty="Tidak ada member yang cocok."
        columns={[
          {
            key: 'name', header: 'Nama',
            render: m => (
              <>
                <strong>{m.name}</strong>
                {m.company && <div className="muted small">{m.company}</div>}
              </>
            ),
          },
          {
            key: 'contact', header: 'Kontak',
            render: m => (
              <>
                {m.phone || '—'}
                {m.email && <div className="muted small">{m.email}</div>}
              </>
            ),
          },
          { key: 'field', header: 'Bidang Usaha', render: m => m.business_field || '—' },
          {
            key: 'renewal', header: 'Renewal',
            render: m =>
              m.renewal_date ? (
                <span className={`pill ${renewalTone(m.renewal_date)}`}>
                  {m.renewal_date.slice(0, 10)}
                </span>
              ) : (
                <span className="muted">—</span>
              ),
          },
          {
            key: 'status', header: 'Status',
            render: m => (
              <select
                value={m.status}
                aria-label={`Status ${m.name}`}
                onChange={e => void changeStatus(m, e.target.value as Member['status'])}
              >
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ),
          },
        ]}
      />
    </>
  )
}
