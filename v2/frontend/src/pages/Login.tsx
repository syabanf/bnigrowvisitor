import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth'

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
        <h1>BNI Visitor</h1>
        <p className="muted">Masuk untuk melanjutkan</p>

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
