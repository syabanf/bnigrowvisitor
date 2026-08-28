import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth'

interface TenantContext {
  matched: boolean
  display_name?: string
  chapter?: { name: string; area_name?: string; city_name?: string }
}

const DEMO_ACCOUNTS = [
  { email: 'national@demo.test', label: 'National Admin', scope: 'Semua chapter' },
  { email: 'grow@demo.test', label: 'Chapter Admin', scope: 'BNI Grow' },
  { email: 'rise@demo.test', label: 'Chapter Admin', scope: 'BNI Rise' },
  { email: 'pic@demo.test', label: 'PIC', scope: 'BNI Grow' },
]

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [tenant, setTenant] = useState<TenantContext | null>(null)

  // Branding comes from the host, so the login screen shows the right chapter
  // before anyone has signed in. An unmatched host is the national entry point,
  // not an error.
  useEffect(() => {
    api.get<TenantContext>('/tenant-context').then(setTenant).catch(() => {})
  }, [])

  const submit = async (mail: string, pass: string) => {
    setError('')
    setBusy(mail)
    try {
      await login(mail, pass)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal.')
    } finally {
      setBusy('')
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void submit(email, password)
  }

  return (
    <div className="login">
      <div className="login__card">
        <h1>{tenant?.matched ? tenant.display_name : 'BNI Visitor'}</h1>
        <p className="muted">
          {tenant?.matched && tenant.chapter?.city_name
            ? `${tenant.chapter.city_name} · masuk untuk melanjutkan`
            : 'Masuk untuk melanjutkan'}
        </p>

        {error && <div className="alert">{error}</div>}

        <form onSubmit={onSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email" type="email" value={email} autoComplete="username"
            onChange={e => setEmail(e.target.value)} placeholder="nama@domain.com" required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password" type="password" value={password} autoComplete="current-password"
            onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
          />

          <button type="submit" className="btn btn--primary" disabled={!!busy}>
            {busy ? 'Memproses…' : 'Masuk ke Akun'}
          </button>
        </form>

        <div className="divider"><span>Akun Demo</span></div>
        <div className="demo-grid">
          {DEMO_ACCOUNTS.map(account => (
            <button
              key={account.email}
              type="button"
              className="demo-card"
              disabled={!!busy}
              onClick={() => void submit(account.email, 'demo123')}
              aria-label={`Masuk sebagai ${account.label} — ${account.scope}`}
            >
              <strong>{account.label}</strong>
              <span className="muted">{account.scope}</span>
            </button>
          ))}
        </div>
        <p className="muted center small">Semua akun demo memakai password <code>demo123</code></p>
      </div>
    </div>
  )
}
