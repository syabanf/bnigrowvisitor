import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import Icon, { type IconName } from './Icon'
import Assistant from './Assistant'
import TabBar from './TabBar'

interface NavItem {
  to: string
  label: string
  icon: IconName
  // Only the index route matches exactly; every other path would otherwise
  // stay highlighted for its own children.
  end?: boolean
  // Roles that may see this link. Absent means everyone signed in.
  //
  // The API is the gate and refuses these regardless; this stops the nav from
  // advertising a door that is locked. A PIC was being offered Akun and got a
  // permission error for clicking it, which reads as the app being broken
  // rather than as the boundary working.
  roles?: string[]
}


// Screens that read across every tenant. Hidden here and refused by the API —
// the nav is a convenience, not the gate.

interface NavSection {
  // Absent on the first group: the top items need no heading to be understood,
  // and a label above "Dashboard" is noise.
  title?: string
  items: NavItem[]
}

// Grouped rather than one list. A national admin sees nineteen destinations,
// and as a flat column they read as an undifferentiated wall — the headings are
// what let someone find "Policy" without reading all nineteen.
const CHAPTER_NAV: NavSection[] = [
  {
    items: [
      { to: '/', label: 'Dashboard', icon: 'chart', end: true },
      { to: '/pipeline', label: 'Pipeline', icon: 'board' },
    ],
  },
  {
    title: 'Data',
    items: [
      { to: '/visitors', label: 'Visitor', icon: 'users' },
      { to: '/mcqa', label: 'MCQA', icon: 'check' },
      { to: '/members', label: 'Member', icon: 'user' },
      { to: '/guests', label: 'Guest', icon: 'users' },
      { to: '/meetings', label: 'Meeting', icon: 'calendar' },
    ],
  },
  {
    title: 'Komunikasi',
    items: [
      { to: '/wa-blast', label: 'WA Blast', icon: 'message' },
      { to: '/text-format', label: 'Text Format', icon: 'clipboard' },
    ],
  },
  {
    title: 'Alat',
    items: [
      { to: '/transfer', label: 'Export/Import', icon: 'download' },
      { to: '/activity', label: 'Log', icon: 'clock' },
      { to: '/accounts', label: 'Akun', icon: 'settings', roles: ['admin', 'national_admin', 'chapter_admin'] },
      { to: '/my-account', label: 'Profil', icon: 'user' },
    ],
  },
]

// Screens that read across every tenant. Hidden here and refused by the API —
// the nav is a convenience, not the gate.
const NATIONAL_NAV: NavSection[] = [
  {
    title: 'Nasional',
    items: [
      { to: '/national', label: 'Ringkasan', icon: 'chart' },
      { to: '/master', label: 'Master Wilayah', icon: 'map' },
      { to: '/policies', label: 'Policy', icon: 'sliders' },
      { to: '/governance', label: 'Audit', icon: 'shield' },
    ],
  },
  {
    title: 'Integrasi',
    items: [
      { to: '/api-keys', label: 'API Keys', icon: 'key' },
      { to: '/api-docs', label: 'Dokumentasi API', icon: 'clipboard' },
    ],
  },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  const isNational = user?.role === 'national_admin' || user?.role === 'admin'
  // Filtered per item, then any section left empty is dropped — otherwise a
  // heading could survive with nothing under it.
  const nav = (isNational ? [...CHAPTER_NAV, ...NATIONAL_NAV] : CHAPTER_NAV)
    .map(section => ({
      ...section,
      items: section.items.filter(
        item => !item.roles || (user ? item.roles.includes(user.role) : false),
      ),
    }))
    .filter(section => section.items.length > 0)

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

          {nav.map((section, i) => (
            <div className="navgroup" key={section.title ?? `g${i}`}>
              {section.title && <p className="navgroup__title">{section.title}</p>}
              {section.items.map(item => (
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
            </div>
          ))}
        </nav>

        <main className="content">
          <Outlet />
        </main>

        <Assistant />
      </div>

      {/* Phone only. The drawer stays for everything the bar cannot hold. */}
      <TabBar onMore={() => setDrawerOpen(true)} />
    </div>
  )
}
