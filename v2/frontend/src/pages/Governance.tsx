import Table from '../components/Table'
import { useResource } from '../hooks/useResource'

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

export default function Governance() {
  const { items, total, loading, error } = useResource<LoginAttempt>('/governance/logins', {})

  const failed = items.filter(a => !a.success).length

  return (
    <>
      <h1>Governance &amp; Audit</h1>
      <p className="muted small">Riwayat percobaan login lintas chapter.</p>

      {error && <div className="alert">{error}</div>}

      <div className="stat-grid">
        <div className="stat">
          <span className="stat__label">Total Percobaan</span>
          <span className="stat__value">{total}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Gagal</span>
          <span className={`stat__value${failed > 0 ? ' stat__value--warn' : ''}`}>{failed}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Berhasil</span>
          <span className="stat__value stat__value--good">{items.length - failed}</span>
        </div>
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
    </>
  )
}
