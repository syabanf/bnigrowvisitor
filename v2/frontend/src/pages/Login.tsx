import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth'

interface TenantContext {
  matched: boolean
  display_name?: string
  chapter?: { name: string; area_name?: string; city_name?: string }
}

interface DemoAccount {
  email: string
  name: string
  role: string
  label: string
  scope: string
}

interface DemoAccounts {
  accounts: DemoAccount[]
  password: string
}

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [tenant, setTenant] = useState<TenantContext | null>(null)
  const [demo, setDemo] = useState<DemoAccounts | null>(null)

  // Branding comes from the host, so the login screen shows the right chapter
  // before anyone has signed in. An unmatched host is the national entry point,
  // not an error.
  useEffect(() => {
    api.get<TenantContext>('/tenant-context').then(setTenant).catch(() => {})
    // Fetched rather than hardcoded. The previous list was written by hand and
    // could name an account nobody had checked still existed; this one comes
    // from the same place the accounts do. A 404 means demo mode is off, which
    // is the normal answer in a real deployment — so the panel simply does not
    // render, and nothing is logged as if it were a fault.
    api.get<DemoAccounts>('/demo-accounts').then(setDemo).catch(() => setDemo(null))
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

        {demo?.accounts?.length ? (
          <>
            <div className="divider"><span>Masuk Cepat</span></div>
            <div className="demo-grid">
              {demo.accounts.map(account => (
                <button
                  key={account.email}
                  type="button"
                  className={`demo-card${busy === account.email ? ' demo-card--busy' : ''}`}
                  disabled={!!busy}
                  onClick={() => void submit(account.email, demo.password)}
                  aria-label={`Masuk sebagai ${account.name}, ${account.label}, ${account.scope}`}
                >
                  <strong>{account.label}</strong>
                  <span className="muted">{account.scope}</span>
                  {/* The person, not just the role: the demo data refers to
                      these names, so knowing who you are signed in as is what
                      makes the visitor and activity rows read as a story. */}
                  <span className="demo-card__who">{account.name}</span>
                </button>
              ))}
            </div>
            <p className="muted center small">
              Semua akun demo memakai password <code>{demo.password}</code>
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}
