import { useState } from 'react'
import Table from '../components/Table'
import Pagination from '../components/Pagination'
import { useResource } from '../hooks/useResource'

interface LogEntry {
  id: string
  actor_name?: string
  actor_role?: string
  action: string
  entity: string
  entity_label?: string
  created_at: string
}

const ACTION_LABEL: Record<string, string> = {
  create: 'Tambah',
  update: 'Ubah',
  delete: 'Hapus',
}

const ENTITY_LABEL: Record<string, string> = {
  visitor: 'Visitor',
  member: 'Member',
  guest: 'Tamu',
  meeting: 'Meeting',
  user: 'Akun',
}

export default function Activity() {
  const [action, setAction] = useState('')
  const [entity, setEntity] = useState('')
  const {
    items, total, loading, error, page, setPage, pageSize, setPageSize,
  } = useResource<LogEntry>('/activity', { action, entity })

  return (
    <>
      <h1>Log Aktivitas</h1>
      <p className="muted small">Jejak perubahan data di chapter ini.</p>

      <div className="filters">
        <select value={action} onChange={e => setAction(e.target.value)} aria-label="Filter aksi">
          <option value="">Semua Aksi</option>
          {Object.entries(ACTION_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={entity} onChange={e => setEntity(e.target.value)} aria-label="Filter objek">
          <option value="">Semua Objek</option>
          {Object.entries(ENTITY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {error && <div className="alert">{error}</div>}

      <Table
        rows={items}
        loading={loading}
        rowKey={l => l.id}
        empty="Belum ada aktivitas tercatat."
        columns={[
          {
            key: 'when', header: 'Waktu',
            render: l => new Date(l.created_at).toLocaleString('id-ID', {
              dateStyle: 'medium', timeStyle: 'short',
            }),
          },
          {
            key: 'actor', header: 'Oleh',
            render: l => (
              <>
                {l.actor_name || '—'}
                {l.actor_role && <div className="muted small">{l.actor_role}</div>}
              </>
            ),
          },
          {
            key: 'action', header: 'Aksi',
            render: l => <span className="pill">{ACTION_LABEL[l.action] ?? l.action}</span>,
          },
          { key: 'entity', header: 'Objek', render: l => ENTITY_LABEL[l.entity] ?? l.entity },
          { key: 'label', header: 'Detail', render: l => l.entity_label || '—' },
        ]}
      />

      <Pagination
        page={page} pageSize={pageSize} total={total} shown={items.length}
        onPage={setPage} onPageSize={setPageSize}
      />
    </>
  )
}
