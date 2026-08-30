import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth'
import Icon, { type IconName } from '../components/Icon'

// One icon per role, so the quick sign-in list is scannable by shape before it
// is read. Anything unmapped falls back to a person.
const ROLE_ICON: Record<string, IconName> = {
  admin: 'shield',
  national_admin: 'map',
  chapter_admin: 'settings',
  pic: 'users',
  member: 'user',
}

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
  // Typing a password blind is the most common cause of a failed sign-in, and
  // this screen has no "forgot password" to fall back on.
  const [reveal, setReveal] = useState(false)

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

  const heading = tenant?.matched ? tenant.display_name : 'BNI Visitor'
  const place = [tenant?.chapter?.city_name, tenant?.chapter?.area_name]
    .filter(Boolean).join(' · ')

  return (
    <div className="login">
      {/* Identity first, and on its own side of the screen. On a per-chapter
          subdomain the thing worth confirming before typing a password is that
          you are on the right chapter — a centred card names it in passing. */}
      <aside className="login__brand">
        <div className="login__mark"><Icon name="building" size={1.4} /></div>
        {/* Wrapped so the compact mobile header can lay the mark beside the
            text without the name and the place competing for the same row. */}
        <div className="login__ident">
          <h1 className="login__title">{heading}</h1>
          {place && <p className="login__place">{place}</p>}
        </div>
        <p className="login__pitch">
          Kelola visitor, member, meeting, dan follow-up chapter dalam satu tempat.
        </p>
        <ul className="login__points">
          <li><Icon name="users" size={0.9} /> Pipeline visitor sampai jadi member</li>
          <li><Icon name="calendar" size={0.9} /> Meeting, tamu, dan kehadiran</li>
          <li><Icon name="message" size={0.9} /> Blast WhatsApp dari template</li>
        </ul>
      </aside>

      <main className="login__panel">
        <div className="login__form-head">
          <h2>Masuk</h2>
          <p className="muted small">Gunakan akun yang terdaftar di chapter kamu.</p>
        </div>

        {error && (
          <div className="alert" role="alert">
            <Icon name="alert" size={0.95} /> <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="login__form">
          <label htmlFor="email">Email</label>
          <input
            id="email" type="email" value={email} autoComplete="username"
            onChange={e => setEmail(e.target.value)} placeholder="nama@domain.com" required
          />

          <label htmlFor="password">Password</label>
          <div className="field-with-action">
            <input
              id="password" type={reveal ? 'text' : 'password'} value={password}
              autoComplete="current-password"
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
            />
            <button
              type="button" className="field-action" onClick={() => setReveal(v => !v)}
              aria-pressed={reveal}
            >
              <Icon
                name={reveal ? 'eye-off' : 'eye'}
                label={reveal ? 'Sembunyikan password' : 'Tampilkan password'}
              />
            </button>
          </div>

          <button type="submit" className="btn btn--primary btn--block" disabled={!!busy}>
            {busy ? 'Memproses…' : 'Masuk ke Akun'}
          </button>
        </form>

        {demo?.accounts?.length ? (
          <>
            <div className="divider"><span>Masuk Cepat</span></div>
            <div className="demo-list">
              {demo.accounts.map(account => (
                <button
                  key={account.email}
                  type="button"
                  className={`demo-row${busy === account.email ? ' demo-row--busy' : ''}`}
                  disabled={!!busy}
                  onClick={() => void submit(account.email, demo.password)}
                  aria-label={`Masuk sebagai ${account.name}, ${account.label}, ${account.scope}`}
                >
                  <span className="demo-row__icon">
                    <Icon name={ROLE_ICON[account.role] ?? 'user'} size={0.95} />
                  </span>
                  <span className="demo-row__text">
                    <strong>{account.label}</strong>
                    <span className="demo-row__who">{account.name} · {account.scope}</span>
                  </span>
                  <Icon name="chevron-right" size={0.9} className="demo-row__go" />
                </button>
              ))}
            </div>
            <p className="muted center small">
              Semua akun demo memakai password <code>{demo.password}</code>
            </p>
          </>
        ) : null}
      </main>
    </div>
  )
}
