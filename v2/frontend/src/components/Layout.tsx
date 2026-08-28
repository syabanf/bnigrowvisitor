import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import Icon, { type IconName } from './Icon'

interface NavItem {
  to: string
  label: string
  icon: IconName
  // Only the index route matches exactly; every other path would otherwise
  // stay highlighted for its own children.
  end?: boolean
}

const CHAPTER_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'chart', end: true },
  { to: '/pipeline', label: 'Pipeline', icon: 'board' },
  { to: '/visitors', label: 'Visitor', icon: 'users' },
  { to: '/mcqa', label: 'MCQA', icon: 'check' },
  { to: '/members', label: 'Member', icon: 'user' },
  { to: '/guests', label: 'Guest', icon: 'users' },
  { to: '/meetings', label: 'Meeting', icon: 'calendar' },
  { to: '/wa-blast', label: 'WA Blast', icon: 'message' },
  { to: '/text-format', label: 'Text Format', icon: 'clipboard' },
  { to: '/transfer', label: 'Export/Import', icon: 'download' },
  { to: '/activity', label: 'Log', icon: 'clock' },
  { to: '/accounts', label: 'Akun', icon: 'settings' },
  { to: '/my-account', label: 'Profil', icon: 'user' },
]

// Screens that read across every tenant. Hidden here and refused by the API —
// the nav is a convenience, not the gate.
const NATIONAL_NAV: NavItem[] = [
  { to: '/national', label: 'Nasional', icon: 'chart' },
  { to: '/master', label: 'Master Wilayah', icon: 'map' },
  { to: '/policies', label: 'Policy', icon: 'sliders' },
  { to: '/governance', label: 'Audit', icon: 'shield' },
  { to: '/api-keys', label: 'API Keys', icon: 'key' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  const isNational = user?.role === 'national_admin' || user?.role === 'admin'
  const nav = isNational ? [...CHAPTER_NAV, ...NATIONAL_NAV] : CHAPTER_NAV

  // Navigating must close the drawer, or a phone lands on the new page with the
  // menu still covering it.
  useEffect(() => setDrawerOpen(false), [location.pathname])

  // Escape closes it too; a drawer with no visible way out traps keyboard users.
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const startTour = () => window.dispatchEvent(new Event('bni:start-tour'))

  return (
    <div className="shell">
      <header className="topbar">
        <button
          className="topbar__menu"
          onClick={() => setDrawerOpen(true)}
          aria-label="Buka menu"
          aria-expanded={drawerOpen}
        >
          <Icon name="menu" size={1.15} />
        </button>

        <div className="topbar__brand">
          <strong>BNI Visitor</strong>
          <span className="muted small">
            {user?.chapter_name ?? 'Semua chapter'} · {user?.name}
          </span>
        </div>

        <div className="topbar__actions">
          <button className="btn btn--ghost" onClick={startTour}>
            <Icon name="help" />
            <span className="hide-sm">Tour</span>
          </button>
          <button className="btn btn--ghost" onClick={() => void logout()}>
            <Icon name="logout" />
            <span className="hide-sm">Keluar</span>
          </button>
        </div>
      </header>

      {/* Sidebar on a laptop, slide-in drawer below that. One list, one source
          of truth — a separate mobile menu is how the two drift apart. */}
      <div className={`layout${drawerOpen ? ' layout--open' : ''}`}>
        <div
          className="scrim"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />

        <nav className="sidenav" aria-label="Menu utama">
          <div className="sidenav__head">
            <span className="sidenav__title">Menu</span>
            <button
              className="btn btn--small btn--ghost sidenav__close"
              onClick={() => setDrawerOpen(false)}
              aria-label="Tutup menu"
            >
              <Icon name="close" />
            </button>
          </div>

          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-tour={`nav-${item.to}`}
              className={({ isActive }) => `navlink${isActive ? ' navlink--active' : ''}`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
