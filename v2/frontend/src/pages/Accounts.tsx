import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import Table from '../components/Table'
import { useAuth } from '../auth'
import type { Role, User } from '../api/types'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  national_admin: 'National Admin',
  chapter_admin: 'Chapter Admin',
  pic: 'PIC',
  member: 'Member',
}

// A chapter admin may only mint roles at or below their own. The API enforces
// this too — this list just keeps the form from offering a doomed choice.
function grantableRoles(actor?: Role): Role[] {
  if (actor === 'admin' || actor === 'national_admin') {
    return ['national_admin', 'chapter_admin', 'pic', 'member']
  }
  return ['pic', 'member']
}

export default function Accounts() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'pic', phone: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<{ data: User[] }>('/accounts')
      setUsers(res.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat akun.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.post('/accounts', form)
      setNotice(`Akun ${form.email} dibuat.`)
      setForm({ name: '', email: '', password: '', role: 'pic', phone: '' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat akun.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (target: User) => {
    try {
      await api.patch(`/accounts/${target.id}/active`, { is_active: !target.is_active })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status akun.')
    }
  }

  return (
    <>
      <h1>Kelola Akun</h1>

      {error && <div className="alert">{error}</div>}
      {notice && <div className="alert alert--ok">{notice}</div>}

      <section className="card">
        <h2>Tambah Akun</h2>
        <form onSubmit={create} className="form-grid">
          <div>
            <label htmlFor="acc-name">Nama</label>
            <input id="acc-name" value={form.name} required
                   onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="acc-email">Email</label>
            <input id="acc-email" type="email" value={form.email} required
                   onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label htmlFor="acc-pass">Password</label>
            <input id="acc-pass" type="password" value={form.password} required minLength={6}
                   onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label htmlFor="acc-role">Peran</label>
            <select id="acc-role" value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}>
              {grantableRoles(user?.role).map(r => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="acc-phone">Telepon</label>
            <input id="acc-phone" value={form.phone}
                   onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-grid__action">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Menyimpan…' : 'Buat Akun'}
            </button>
          </div>
        </form>
      </section>

      <Table
        rows={users}
        loading={loading}
        rowKey={u => u.id}
        empty="Belum ada akun."
        columns={[
          {
            key: 'name', header: 'Nama',
            render: u => (
              <>
                <strong>{u.name}</strong>
                <div className="muted small">{u.email}</div>
              </>
            ),
          },
          { key: 'role', header: 'Peran', render: u => <span className="pill">{ROLE_LABEL[u.role] ?? u.role}</span> },
          { key: 'phone', header: 'Telepon', render: u => u.phone || '—' },
          { key: 'chapter', header: 'Chapter', render: u => u.chapter_name || '—' },
          {
            key: 'active', header: 'Status',
            render: u =>
              u.id === user?.id ? (
                // Disabling your own account would lock you out with no way back.
                <span className="muted small">akun Anda</span>
              ) : (
                <button className="btn btn--small" onClick={() => void toggleActive(u)}>
                  {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              ),
          },
        ]}
      />
    </>
  )
}
