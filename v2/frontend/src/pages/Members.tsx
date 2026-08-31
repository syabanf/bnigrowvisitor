import { useState } from 'react'
import { api } from '../api/client'
import { formatDate, daysUntil } from '../lib/format'
import StatusSelect from '../components/StatusSelect'
import SummaryCards from '../components/SummaryCards'
import Table from '../components/Table'
import Pagination from '../components/Pagination'
import { useResource } from '../hooks/useResource'
import PageHeader from '../components/PageHeader'

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

// Active is deliberately the quiet one: on a list where most rows are active,
// colouring them all makes the two that are not disappear.
const MEMBER_TONE: Record<Member['status'], string> = {
  active: 'pill--quiet',
  inactive: 'pill--muted',
  suspended: 'pill--danger',
}

function renewalTone(date?: string): string {
  const days = daysUntil(date)
  if (days === null) return ''
  if (days < 0) return 'pill--danger'
  if (days < 30) return 'pill--warn'
  return 'pill--quiet'
}

export default function Members() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const { items, total, loading, error, reload, setError, page, setPage, pageSize, setPageSize, extra } =
    useResource<Member, { by_status: Record<string, number> }>('/members', { q: search, status })

  // The two renewal buckets are derived from the date by the server, not stored,
  // so a member whose renewal passed overnight counts as overdue on the next
  // read without anything having to update the row.
  const by = extra?.by_status ?? {}
  // Status buckets only — the two renewal keys are derived counts over the same
  // rows, so adding them in would double-count.
  const allCount = Object.entries(by)
    .filter(([k]) => !k.startsWith('__'))
    .reduce((sum, [, v]) => sum + v, 0)
  const cards = [
    { key: '', label: 'Semua', value: allCount, icon: 'users' as const },
    { key: 'active', label: 'Aktif', value: by.active ?? 0, icon: 'check' as const, tone: 'pill--good' },
    // Counts, not filters: the list has no renewal filter for these to switch
    // on, so they render plainly rather than as buttons that do nothing.
    { key: '__due', label: 'Renewal < 30 hari', value: by.__due_soon ?? 0, icon: 'clock' as const, tone: 'pill--warn', selectable: false },
    { key: '__late', label: 'Lewat Tanggal', value: by.__overdue ?? 0, icon: 'alert' as const, tone: 'pill--danger', selectable: false },
  ]

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
      <PageHeader title="Member" count={`${total.toLocaleString('id-ID')} member`} />

      <SummaryCards cards={cards} active={status} onSelect={setStatus} />

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
                  {formatDate(m.renewal_date)}
                </span>
              ) : (
                <span className="muted">—</span>
              ),
          },
          {
            key: 'status', header: 'Status',
            render: m => (
              <StatusSelect
                value={m.status}
                options={STATUS_LABEL}
                label={`Status ${m.name}`}
                tone={v => MEMBER_TONE[v]}
                onChange={next => void changeStatus(m, next)}
              />
            ),
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
