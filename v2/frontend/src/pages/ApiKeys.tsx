import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import Icon from '../components/Icon'
import Table from '../components/Table'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  scope: string
  is_active: boolean
  last_used_at?: string
  expires_at?: string
  created_at: string
  plain_key?: string
}

interface Scope {
  value: string
  description: string
}

const EXPIRY_CHOICES = [
  { days: 0, label: 'Tanpa batas' },
  { days: 30, label: '30 hari' },
  { days: 90, label: '90 hari' },
  { days: 365, label: '1 tahun' },
]

// A key can be unusable for three different reasons, and the row has to say
// which: deactivated is reversible from here, expired is not, and a key that
// has never been called may simply not be wired up yet.
function keyState(k: ApiKey): { label: string; tone: string } {
  if (!k.is_active) return { label: 'Nonaktif', tone: 'pill--muted' }
  if (k.expires_at && new Date(k.expires_at) < new Date()) {
    return { label: 'Kedaluwarsa', tone: 'pill--danger' }
  }
  if (k.expires_at) {
    const days = Math.ceil((new Date(k.expires_at).getTime() - Date.now()) / 86_400_000)
    if (days <= 14) return { label: `Berakhir ${days} hari lagi`, tone: 'pill--warn' }
  }
  return { label: 'Aktif', tone: 'pill--good' }
}

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [issued, setIssued] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', scope: 'finance', expires_in_days: 90 })
  const [scopes, setScopes] = useState<Scope[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get<{ data: ApiKey[] }>('/api-keys')
      setKeys(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat API key.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // Fetched, not hardcoded. The list used to be written into this file and
    // offered "readonly", which every external route then refused — a key that
    // looked issued and worked nowhere.
    api.get<{ data: Scope[] }>('/api-keys/scopes').then(r => setScopes(r.data)).catch(() => {})
  }, [])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const res = await api.post<{ data: ApiKey }>('/api-keys', form)
      // Shown once and never retrievable: the server stores only a hash.
      setIssued(res.data.plain_key ?? null)
      setForm({ name: '', scope: 'finance', expires_in_days: 90 })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat API key.')
    }
  }

  const toggle = async (key: ApiKey) => {
    try {
      await api.patch(`/api-keys/${key.id}/active`, { is_active: !key.is_active })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status.')
    }
  }

  const remove = async (key: ApiKey) => {
    try {
      await api.delete(`/api-keys/${key.id}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus.')
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>API Keys</h1>
          <p className="muted small">
            Kunci untuk integrasi eksternal. Server hanya menyimpan hash-nya — kunci
            aslinya tampil sekali saja saat dibuat dan tidak bisa dipulihkan.
          </p>
        </div>
        <Link to="/api-docs" className="btn">
          <Icon name="clipboard" /> Dokumentasi API
        </Link>
      </div>

      {error && <div className="alert">{error}</div>}

      {issued && (
        <div className="alert alert--ok">
          <strong>Salin sekarang — kunci ini tidak akan ditampilkan lagi:</strong>
          <pre className="preview">{issued}</pre>
          <button className="btn btn--small" onClick={() => setIssued(null)}>Sudah disalin</button>
        </div>
      )}

      <section className="card">
        <h2>Buat API Key</h2>
        <form className="form-grid" onSubmit={create}>
          <div>
            <label htmlFor="k-name">Nama</label>
            <input id="k-name" value={form.name} required placeholder="Integrasi Keuangan"
                   onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="k-scope">Scope</label>
            <select id="k-scope" value={form.scope}
                    onChange={e => setForm({ ...form, scope: e.target.value })}>
              {scopes.map(s => <option key={s.value} value={s.value}>{s.value}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="k-exp">Masa berlaku</label>
            <select id="k-exp" value={form.expires_in_days}
                    onChange={e => setForm({ ...form, expires_in_days: Number(e.target.value) })}>
              {EXPIRY_CHOICES.map(c => (
                <option key={c.days} value={c.days}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="form-grid__action">
            <button className="btn btn--primary">Buat</button>
          </div>
        </form>

        {/* What each scope permits, from the server. Choosing one is choosing a
            permission, and the word alone does not say which. */}
        {scopes.length > 0 && (
          <dl className="scope-help">
            {scopes.map(s => (
              <div key={s.value}>
                <dt><code>{s.value}</code></dt>
                <dd>{s.description}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <Table
        rows={keys}
        loading={loading}
        rowKey={k => k.id}
        empty="Belum ada API key."
        columns={[
          { key: 'name', header: 'Nama', render: k => <strong>{k.name}</strong> },
          { key: 'prefix', header: 'Prefix', render: k => <code>{k.key_prefix}…</code> },
          { key: 'scope', header: 'Scope', render: k => <span className="pill">{k.scope}</span> },
          {
            key: 'used', header: 'Terakhir Dipakai',
            render: k => (k.last_used_at
              ? new Date(k.last_used_at).toLocaleDateString('id-ID')
              : <span className="muted">belum pernah</span>),
          },
          {
            key: 'exp', header: 'Berlaku Sampai',
            render: k => (k.expires_at
              ? new Date(k.expires_at).toLocaleDateString('id-ID')
              : <span className="muted">tanpa batas</span>),
          },
          {
            key: 'state', header: 'Status',
            render: k => {
              const s = keyState(k)
              return <span className={`pill ${s.tone}`}>{s.label}</span>
            },
          },
          {
            key: 'act', header: '',
            render: k => (
              <div className="row-gap">
                <button className="btn btn--small" onClick={() => void toggle(k)}>
                  {k.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button className="btn btn--small" onClick={() => void remove(k)}>Hapus</button>
              </div>
            ),
          },
        ]}
      />
    </>
  )
}
