import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import Icon from '../components/Icon'

interface Param { name: string; in: string; description: string }
interface Example { request: string; response: string }

interface Endpoint {
  method: string
  path: string
  scope: string
  summary: string
  params?: Param[]
  request_body?: string
  response: string
  notes?: string[]
  example: Example
}

interface Docs {
  base_url: string
  auth: { headers: string[]; description: string }
  scopes: { value: string; description: string }[]
  rate_limit: string
  endpoints: Endpoint[]
  errors: { status: number; meaning: string }[]
}

function Copyable({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="code-block">
      <pre>{text}</pre>
      <button
        type="button" className="code-block__copy"
        onClick={() => {
          // The clipboard API is unavailable over plain HTTP on some browsers,
          // so the failure is shown rather than swallowed — silently doing
          // nothing on click is worse than saying it did not work.
          navigator.clipboard?.writeText(text)
            .then(() => { setDone(true); setTimeout(() => setDone(false), 1500) })
            .catch(() => { setDone(false) })
        }}
      >
        <Icon name={done ? 'check' : 'clipboard'} size={0.9} label={done ? 'Tersalin' : 'Salin'} />
      </button>
    </div>
  )
}

export default function ApiDocs() {
  const [docs, setDocs] = useState<Docs | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<Docs>('/api-keys/docs').then(setDocs)
      .catch(err => setError(err instanceof Error ? err.message : 'Gagal memuat dokumentasi.'))
  }, [])

  if (error) return <><h1>Dokumentasi API</h1><div className="alert">{error}</div></>
  if (!docs) return <><h1>Dokumentasi API</h1><p className="muted">Memuat…</p></>

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dokumentasi API</h1>
          <p className="muted small">
            API mesin untuk integrasi. Terpisah dari API yang dipakai aplikasi ini
            sendiri, dan otentikasinya memakai kunci, bukan sesi login.
          </p>
        </div>
        <Link to="/api-keys" className="btn"><Icon name="key" /> Kelola Kunci</Link>
      </div>

      <section className="card">
        <h2>Base URL</h2>
        <Copyable text={docs.base_url} />
      </section>

      <section className="card">
        <h2>Autentikasi</h2>
        <p className="muted small">{docs.auth.description}</p>
        {docs.auth.headers.map(h => <Copyable key={h} text={h} />)}
      </section>

      <section className="card">
        <h2>Scope</h2>
        <dl className="scope-help">
          {docs.scopes.map(s => (
            <div key={s.value}>
              <dt><code>{s.value}</code></dt>
              <dd>{s.description}</dd>
            </div>
          ))}
        </dl>
        <p className="muted small">
          <Icon name="alert" size={0.9} /> Kunci <code>finance</code> mencakup semua yang
          bisa dilakukan <code>readonly</code>, jadi tidak perlu dua kunci terpisah.
        </p>
      </section>

      <section className="card">
        <h2>Batas Laju</h2>
        <p className="muted small">{docs.rate_limit}</p>
      </section>

      <h2 className="section-title">Endpoint</h2>
      {docs.endpoints.map(ep => (
        <section className="card endpoint" key={`${ep.method} ${ep.path}`}>
          <header className="endpoint__head">
            <span className={`method method--${ep.method.toLowerCase()}`}>{ep.method}</span>
            <code className="endpoint__path">{ep.path}</code>
            <span className="pill">{ep.scope}</span>
          </header>
          <p className="endpoint__summary">{ep.summary}</p>

          {ep.params && ep.params.length > 0 && (
            <table className="params">
              <thead>
                <tr><th>Parameter</th><th>Di</th><th>Keterangan</th></tr>
              </thead>
              <tbody>
                {ep.params.map(p => (
                  <tr key={p.name}>
                    <td><code>{p.name}</code></td>
                    <td className="muted">{p.in}</td>
                    <td>{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {ep.request_body && (
            <>
              <h3>Body</h3>
              <Copyable text={ep.request_body} />
            </>
          )}

          <h3>Contoh</h3>
          <Copyable text={ep.example.request} />
          <pre className="preview">{ep.example.response}</pre>

          {ep.notes && ep.notes.length > 0 && (
            <ul className="endpoint__notes">
              {ep.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
        </section>
      ))}

      <section className="card">
        <h2>Kode Error</h2>
        <table className="params">
          <thead><tr><th>Status</th><th>Arti</th></tr></thead>
          <tbody>
            {docs.errors.map(e => (
              <tr key={e.status}><td><code>{e.status}</code></td><td>{e.meaning}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
