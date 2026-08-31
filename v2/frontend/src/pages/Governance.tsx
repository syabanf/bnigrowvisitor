import { useState } from 'react'
import Icon from '../components/Icon'
import Table from '../components/Table'
import Pagination from '../components/Pagination'
import { useResource } from '../hooks/useResource'
import PageHeader from '../components/PageHeader'

interface LoginAttempt {
  id: string
  email: string
  success: boolean
  reason?: string
  ip?: string
  created_at: string
}

const REASON_LABEL: Record<string, string> = {
  user_not_found: 'akun tidak ditemukan',
  wrong_password: 'password salah',
}

type Outcome = '' | 'success' | 'failed'

export default function Governance() {
  const [outcome, setOutcome] = useState<Outcome>('')
  const [search, setSearch] = useState('')
  const {
    items, total, loading, error, page, setPage, pageSize, setPageSize, extra,
  } = useResource<LoginAttempt, { succeeded: number; failed: number }>(
    '/governance/logins', { outcome, q: search.trim() },
  )

  // From the server, not from items: counting the rows on screen would report
  // one page's worth as if it were the whole audit trail, and the three figures
  // would visibly fail to add up as soon as there was a second page.
  const succeeded = extra?.succeeded ?? 0
  const failed = extra?.failed ?? 0

  // Clicking the same card again clears the filter, so the control that applied
  // it is also the one that removes it.
  const toggle = (next: Outcome) => setOutcome(prev => (prev === next ? '' : next))

  return (
    <>
      <PageHeader
        title="Governance & Audit"
        count={`${(succeeded + failed).toLocaleString('id-ID')} percobaan`}
        subtitle={<>Riwayat percobaan login lintas chapter.</>}
      />

      {error && <div className="alert">{error}</div>}

      <div className="filters">
        <input
          type="search" value={search} placeholder="Cari email…"
          onChange={e => setSearch(e.target.value)} aria-label="Cari email"
        />
      </div>

      <div className="stat-grid">
        <button
          type="button" className={`stat stat--action${outcome === '' ? ' stat--on' : ''}`}
          onClick={() => setOutcome('')} aria-pressed={outcome === ''}
        >
          <span className="stat__label">Total Percobaan</span>
          <span className="stat__value">{succeeded + failed}</span>
        </button>
        <button
          type="button" className={`stat stat--action${outcome === 'failed' ? ' stat--on' : ''}`}
          onClick={() => toggle('failed')} aria-pressed={outcome === 'failed'}
        >
          <span className="stat__label">
            <Icon name="alert" size={0.85} /> Gagal
          </span>
          <span className={`stat__value${failed > 0 ? ' stat__value--warn' : ''}`}>{failed}</span>
        </button>
        <button
          type="button" className={`stat stat--action${outcome === 'success' ? ' stat--on' : ''}`}
          onClick={() => toggle('success')} aria-pressed={outcome === 'success'}
        >
          <span className="stat__label">
            <Icon name="check" size={0.85} /> Berhasil
          </span>
          <span className="stat__value stat__value--good">{succeeded}</span>
        </button>
      </div>

      <Table
        rows={items}
        loading={loading}
        rowKey={a => a.id}
        empty="Belum ada percobaan login."
        columns={[
          {
            key: 'when', header: 'Waktu',
            render: a => new Date(a.created_at).toLocaleString('id-ID', {
              dateStyle: 'medium', timeStyle: 'short',
            }),
          },
          { key: 'email', header: 'Email', render: a => a.email || '—' },
          {
            key: 'result', header: 'Hasil',
            render: a => a.success
              ? <span className="pill">berhasil</span>
              : <span className="pill pill--danger">gagal</span>,
          },
          {
            key: 'reason', header: 'Alasan',
            // The reason is recorded but never shown at the login form itself —
            // there it would be an account-enumeration oracle. Here, behind a
            // national-admin gate, it is exactly what an auditor needs.
            render: a => a.reason ? (REASON_LABEL[a.reason] ?? a.reason) : '—',
          },
          { key: 'ip', header: 'IP', render: a => a.ip || '—' },
        ]}
      />

      <Pagination
        page={page} pageSize={pageSize} total={total} shown={items.length}
        onPage={setPage} onPageSize={setPageSize}
      />
    </>
  )
}
