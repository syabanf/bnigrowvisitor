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
      {/* Full-bleed panel rather than a card floating in the middle. On a
          per-chapter subdomain the identity is the frame, not an aside. */}
      <aside className="login__brand">
        <div className="login__brand-top">
          <p className="login__kicker">Visitor Management</p>
          <h1 className="login__title">{heading}</h1>
          {place && <p className="login__place">{place}</p>}
          <p className="login__pitch">
            Catat visitor, kelola member, jadwalkan meeting. Setiap follow-up
            terekam sampai jadi member.
          </p>
        </div>

        <div className="login__brand-foot">
          <p className="login__kicker login__kicker--foot">
            <Icon name="trophy" size={0.95} /> Yang bisa dikelola
          </p>
          <ul className="login__points">
            <li><Icon name="users" size={0.95} /> Pipeline visitor sampai jadi member</li>
            <li><Icon name="calendar" size={0.95} /> Meeting, tamu, dan kehadiran</li>
            <li><Icon name="message" size={0.95} /> Blast WhatsApp dari template</li>
            <li><Icon name="chart" size={0.95} /> Konversi dan kehadiran per chapter</li>
          </ul>
        </div>
      </aside>

      <main className="login__panel">
        <div className="login__form-wrap">
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
            <div className="field-icon">
              <Icon name="mail" size={0.95} className="field-icon__lead" />
              <input
                id="email" type="email" value={email} autoComplete="username"
                onChange={e => setEmail(e.target.value)} placeholder="nama@domain.com" required
              />
            </div>

            <label htmlFor="password">Kata Sandi</label>
            <div className="field-icon">
              <Icon name="lock" size={0.95} className="field-icon__lead" />
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
                  label={reveal ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                />
              </button>
            </div>

            <button type="submit" className="btn btn--primary btn--block" disabled={!!busy}>
              <Icon name="login" size={0.95} /> {busy ? 'Memproses…' : 'Masuk'}
            </button>
          </form>

          {demo?.accounts?.length ? (
            <>
              <div className="divider"><span>Atau coba sebagai</span></div>
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
                      <Icon name={ROLE_ICON[account.role] ?? 'user'} size={1} />
                    </span>
                    <span className="demo-row__text">
                      <strong>{account.label}</strong>
                      <span className="demo-row__who">{account.name} · {account.scope}</span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="muted center small login__note">
                Kata sandi semua akun demo: <code>{demo.password}</code>
              </p>
            </>
          ) : null}

          <p className="muted center small login__help">
            Lupa kata sandi? Hubungi admin chapter kamu.
          </p>
        </div>
      </main>
    </div>
  )
}
