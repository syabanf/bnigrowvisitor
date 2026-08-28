import Table from '../components/Table'
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

export default function Activity() {
  const { items, total, loading, error } = useResource<LogEntry>('/activity', {})

  return (
    <>
      <h1>Log Aktivitas</h1>
      <p className="muted small">Jejak perubahan data di chapter ini.</p>

      {error && <div className="alert">{error}</div>}
      <p className="muted small">{total} entri terakhir</p>

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
          { key: 'entity', header: 'Objek', render: l => l.entity },
          { key: 'label', header: 'Detail', render: l => l.entity_label || '—' },
        ]}
      />
    </>
  )
}
