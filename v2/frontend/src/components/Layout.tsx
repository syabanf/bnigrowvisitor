import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth'

const CHAPTER_NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/visitors', label: 'Visitor' },
  { to: '/mcqa', label: 'MCQA' },
  { to: '/members', label: 'Member' },
  { to: '/guests', label: 'Guest' },
  { to: '/meetings', label: 'Meeting' },
  { to: '/wa-blast', label: 'WA Blast' },
  { to: '/transfer', label: 'Export/Import' },
  { to: '/activity', label: 'Log' },
  { to: '/accounts', label: 'Akun' },
]

export default function Layout() {
  const { user, logout } = useAuth()

  // The national dashboard aggregates every chapter, so the link only appears
  // for the roles the API will actually serve it to.
  const isNational = user?.role === 'national_admin' || user?.role === 'admin'
  const nav = isNational
    ? [...CHAPTER_NAV, { to: '/national', label: 'Nasional' }]
    : CHAPTER_NAV

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
