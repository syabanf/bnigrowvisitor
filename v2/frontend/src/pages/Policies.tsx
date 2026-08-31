import { useEffect, useState } from 'react'
import { api } from '../api/client'
import PageHeader from '../components/PageHeader'

interface Policy {
  id: string
  chapter_id?: string
  policy_type: string
  config: Record<string, unknown>
  chapter_name?: string
  updated_at: string
}

export default function Policies() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [types, setTypes] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = async () => {
    try {
      const res = await api.get<{ data: Policy[]; types: Record<string, string> }>('/policies')
      setPolicies(res.data)
      setTypes(res.types)
      // Each editor starts from the stored value, pretty-printed so a human can
      // actually read and edit it.
      setDrafts(Object.fromEntries(res.data.map(p => [p.id, JSON.stringify(p.config, null, 2)])))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat policy.')
    }
  }

  useEffect(() => { void load() }, [])

  const save = async (policy: Policy) => {
    setError('')
    setNotice('')

    let config: unknown
    try {
      config = JSON.parse(drafts[policy.id] ?? '{}')
    } catch {
      // Caught here so the user sees which policy is malformed rather than a
      // generic 400 from the server.
      setError(`Config ${types[policy.policy_type] ?? policy.policy_type} bukan JSON yang valid.`)
      return
    }

    try {
      await api.post('/policies', {
        policy_type: policy.policy_type,
        chapter_id: policy.chapter_id ?? null,
        config,
      })
      setNotice('Policy tersimpan.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan policy.')
    }
  }

  return (
    <>
      <PageHeader
        title="Template & Policy"
        subtitle={<>Aturan yang berlaku nasional. Baris tanpa chapter adalah default; baris dengan chapter menimpanya untuk chapter itu saja.</>}
      />

      {error && <div className="alert">{error}</div>}
      {notice && <div className="alert alert--ok">{notice}</div>}

      {policies.length === 0 ? (
        <p className="muted">Belum ada policy.</p>
      ) : (
        policies.map(p => (
          <section key={p.id} className="card">
            <h2>
              {types[p.policy_type] ?? p.policy_type}
              {p.chapter_name
                ? <span className="pill pill--warn"> {p.chapter_name}</span>
                : <span className="pill"> default nasional</span>}
            </h2>
            <label htmlFor={`cfg-${p.id}`}>Config (JSON)</label>
            <textarea
              id={`cfg-${p.id}`}
              className="code-area"
              rows={5}
              value={drafts[p.id] ?? ''}
              onChange={e => setDrafts({ ...drafts, [p.id]: e.target.value })}
            />
            <div className="row-end">
              <span className="muted small">
                Diubah {new Date(p.updated_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
              <button className="btn btn--primary btn--small" onClick={() => void save(p)}>Simpan</button>
            </div>
          </section>
        ))
      )}
    </>
  )
}
