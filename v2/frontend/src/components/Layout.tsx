import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth'

interface NavItem {
  to: string
  label: string
  // Only the index route needs exact matching; every other path would then
  // stay highlighted for its own children.
  end?: boolean
}

const CHAPTER_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/visitors', label: 'Visitor' },
  { to: '/mcqa', label: 'MCQA' },
  { to: '/members', label: 'Member' },
  { to: '/guests', label: 'Guest' },
  { to: '/meetings', label: 'Meeting' },
  { to: '/wa-blast', label: 'WA Blast' },
  { to: '/text-format', label: 'Text Format' },
  { to: '/transfer', label: 'Export/Import' },
  { to: '/activity', label: 'Log' },
  { to: '/accounts', label: 'Akun' },
  { to: '/my-account', label: 'Profil' },
]

// Screens that read across every tenant. Hidden here and refused by the API —
// the nav is a convenience, not the gate.
const NATIONAL_NAV: NavItem[] = [
  { to: '/national', label: 'Nasional' },
  { to: '/master', label: 'Master Wilayah' },
  { to: '/policies', label: 'Policy' },
  { to: '/governance', label: 'Audit' },
  { to: '/api-keys', label: 'API Keys' },
]

export default function Layout() {
  const { user, logout } = useAuth()

  // The national dashboard aggregates every chapter, so the link only appears
  // for the roles the API will actually serve it to.
  const isNational = user?.role === 'national_admin' || user?.role === 'admin'
  const nav = isNational ? [...CHAPTER_NAV, ...NATIONAL_NAV] : CHAPTER_NAV

  return (
    <div className="shell">
      <header className="shell__bar">
        <div>
          <strong>BNI Visitor</strong>
          <div className="muted small">
            {user?.chapter_name ?? 'Semua chapter'} · {user?.name}
          </div>
        </div>
        <button className="btn" onClick={() => void logout()}>Keluar</button>
      </header>

      <nav className="shell__nav">
        {nav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `navlink${isActive ? ' navlink--active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  )
}
