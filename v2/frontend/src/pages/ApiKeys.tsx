import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import Table from '../components/Table'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  scope: string
  is_active: boolean
  last_used_at?: string
  created_at: string
  plain_key?: string
}

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [issued, setIssued] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', scope: 'finance' })

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

  useEffect(() => { void load() }, [])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const res = await api.post<{ data: ApiKey }>('/api-keys', form)
      // Shown once and never retrievable: the server stores only a hash.
      setIssued(res.data.plain_key ?? null)
      setForm({ name: '', scope: 'finance' })
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
      <h1>API Keys</h1>
      <p className="muted small">
        Kunci untuk integrasi eksternal. Server hanya menyimpan hash-nya — kunci aslinya
        tampil sekali saja saat dibuat dan tidak bisa dipulihkan.
      </p>

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
            <select id="k-scope" value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })}>
              <option value="finance">finance</option>
              <option value="readonly">readonly</option>
            </select>
          </div>
          <div className="form-grid__action">
            <button className="btn btn--primary">Buat</button>
          </div>
        </form>
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
            render: k => (k.last_used_at ? new Date(k.last_used_at).toLocaleDateString('id-ID') : <span className="muted">belum pernah</span>),
          },
          {
            key: 'act', header: 'Status',
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
