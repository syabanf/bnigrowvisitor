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

// Roles as people describe themselves, not as the database stores them.
const ROLE_TITLE: Record<string, string> = {
  admin: 'Super Admin',
  national_admin: 'National Admin',
  chapter_admin: 'Chapter Admin',
  pic: 'PIC',
  member: 'Member',
}

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

  // The topbar names the current page. Taken from the nav rather than kept as a
  // second list: a title that can disagree with the menu is worse than none.
  // Longest match first, so /api-keys does not answer for /api-docs.
  const current = nav
    .flatMap(section => section.items)
    .filter(item => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))
    .sort((a, b) => b.to.length - a.to.length)[0]

  // Initials for the avatar. Two words at most — three letters in a circle
  // stops being readable at this size.
  const initials = (user?.name ?? '')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map(word => word[0]?.toUpperCase() ?? '').join('')

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

        {/* The page name, not the product name. The product is named in the
            sidebar, where it stays put; the topbar is the one place that can
            say which screen you are looking at once the page has scrolled. */}
        <h2 className="topbar__page">{current?.label ?? 'BNI Visitor'}</h2>

        <div className="topbar__actions">
          <button className="btn btn--pill" onClick={startTour}>
            <Icon name="help" />
            <span className="hide-sm">Tour</span>
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
          {/* Product identity lives with the navigation, which is the part of
              the screen that never changes. */}
          <div className="sidenav__brand">
            <strong>BNI Visitor</strong>
            <span>{user?.chapter_name ?? 'Semua chapter'}</span>
          </div>

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

          {/* Only the menu scrolls. The brand above and the account below stay
              put — an account block that scrolls out of reach is the one thing
              in a sidebar people go looking for. */}
          <div className="sidenav__scroll">
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
          </div>

          {/* Who you are signed in as, pinned to the foot. It was in the topbar,
              squeezed beside the product name and the page name; here it has
              room and sits where an account menu is looked for. */}
          <div className="sidenav__user">
            <span className="avatar" aria-hidden="true">{initials || '—'}</span>
            <span className="sidenav__who">
              <strong>{user?.name}</strong>
              <span>{ROLE_TITLE[user?.role ?? ''] ?? user?.role}</span>
            </span>
            <button
              className="btn btn--ghost btn--icon sidenav__signout"
              onClick={() => void logout()}
            >
              <Icon name="logout" label="Keluar" />
            </button>
          </div>
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
