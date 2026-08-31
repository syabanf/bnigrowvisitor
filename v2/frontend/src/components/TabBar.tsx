import { NavLink } from 'react-router-dom'
import Icon, { type IconName } from './Icon'

interface Tab {
  to: string
  label: string
  icon: IconName
  end?: boolean
}

/**
 * Primary navigation on a phone.
 *
 * A hamburger drawer is a desktop menu made narrow: every destination costs a
 * tap to open, a read, and a tap to choose. A bar puts the four screens people
 * actually move between one thumb-reach away, and leaves the drawer for the
 * rest — which is what the sheet is good at.
 *
 * Four, not more: past that the labels truncate and the targets shrink below
 * what a thumb reliably hits.
 */
const TABS: Tab[] = [
  { to: '/', label: 'Dashboard', icon: 'chart', end: true },
  { to: '/visitors', label: 'Visitor', icon: 'users' },
  { to: '/members', label: 'Member', icon: 'user' },
  { to: '/meetings', label: 'Meeting', icon: 'calendar' },
]

export default function TabBar({ onMore }: { onMore: () => void }) {
  return (
    <nav className="tabbar" aria-label="Navigasi utama">
      {TABS.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `tabbar__item${isActive ? ' tabbar__item--active' : ''}`}
        >
          <Icon name={tab.icon} size={1.15} />
          <span>{tab.label}</span>
        </NavLink>
      ))}
      <button type="button" className="tabbar__item" onClick={onMore}>
        <Icon name="menu" size={1.15} />
        <span>Lainnya</span>
      </button>
    </nav>
  )
}
