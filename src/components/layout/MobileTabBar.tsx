'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const TABS = [
  {
    id: 'chapter-dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M4 5h16v14H4V5zm4 4h3v6H8V9zm5 2h3v4h-3v-4z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    iconFilled: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm4 3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H8zm5 2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-3z" />
      </svg>
    ),
    path: 'dashboard',
    fallbackPath: '/chapter-dashboard',
  },
  {
    id: 'visitors',
    label: 'Visitor',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    iconFilled: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M9 7a4 4 0 1 1 0 8A4 4 0 0 1 9 7zm8 1a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM1 19c0-3.314 3.134-6 7-6h2c3.866 0 7 2.686 7 6v2H1v-2zm15 2v-2c0-1.2-.4-2.3-1.1-3.2A5.01 5.01 0 0 1 22 19v2h-6z" />
      </svg>
    ),
    path: 'visitors',
    fallbackPath: '/visitors',
  },
  {
    id: 'guests',
    label: 'Guest',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-7 18a7 7 0 0 1 14 0M19 8h3M20.5 6.5v3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    iconFilled: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM5 21a7 7 0 0 1 14 0H5z" />
        <path d="M19 8h4v2h-4V8z" />
        <path d="M20 6h2v6h-2V6z" />
      </svg>
    ),
    path: 'guests',
    fallbackPath: '/guests',
  },
  {
    id: 'kanban',
    label: 'Pipeline',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M3 3h5v18H3V3zm7 0h5v12h-5V3zm7 0h5v15h-5V3z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    iconFilled: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <rect x="3" y="3" width="5" height="18" rx="1" />
        <rect x="10" y="3" width="5" height="12" rx="1" />
        <rect x="17" y="3" width="5" height="15" rx="1" />
      </svg>
    ),
    path: 'pipeline',
    fallbackPath: '/kanban',
  },
  {
    id: 'attended',
    label: 'MCQA',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    iconFilled: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12zm13.707-1.293a1 1 0 0 0-1.414-1.414L11 12.586l-1.293-1.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    path: 'mcqa',
    fallbackPath: '/attended',
  },
  {
    id: 'wa-blast',
    label: 'WA Blast',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    iconFilled: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M5 3a2 2 0 0 0-2 2v14l4-4h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5z" />
      </svg>
    ),
    path: 'wa-blast',
    fallbackPath: '/wa-blast',
  },
]

// National admins have a different menu entirely, so the chapter tabs above
// would navigate them nowhere useful. Icons mirror the sidebar's so the two
// navigations read as the same app.
function strokeIcon(path: string, active: boolean) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.6 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <path d={path} />
    </svg>
  )
}

const NATIONAL_ICON_PATHS: Record<string, string> = {
  'national-overview': 'M3 13h2l2 6 4-14 3 9 2-4h3',
  'national-dashboard': 'M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zM3 14h7v7H3v-7z',
  master: 'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M12 16v4',
  'national-governance': 'M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-4z',
  'national-policies': 'M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z',
  'national-api-keys':
    'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
}

// Labels are deliberately shorter than the sidebar's ("Audit" not
// "Governance & Audit") so six tabs still fit a 375px viewport.
const NATIONAL_TABS = [
  { id: 'national-overview', label: 'Dashboard', absolutePath: '/national-overview' },
  { id: 'national-dashboard', label: 'Chapter', absolutePath: '/national-dashboard' },
  { id: 'master', label: 'Wilayah', absolutePath: '/master' },
  { id: 'national-governance', label: 'Audit', absolutePath: '/national-governance' },
  { id: 'national-policies', label: 'Policy', absolutePath: '/national-policies' },
  { id: 'national-api-keys', label: 'API', absolutePath: '/national-api-keys' },
].map(tab => ({
  ...tab,
  path: undefined as string | undefined,
  fallbackPath: undefined as string | undefined,
  icon: strokeIcon(NATIONAL_ICON_PATHS[tab.id], false),
  iconFilled: strokeIcon(NATIONAL_ICON_PATHS[tab.id], true),
}))

interface MobileTabBarProps {
  currentPage: string
  variant?: 'chapter' | 'national'
}

export default function MobileTabBar({ currentPage, variant = 'chapter' }: MobileTabBarProps) {
  const router = useRouter()
  const [chapterId, setChapterId] = useState('')
  const tabs: typeof NATIONAL_TABS = (variant === 'national' ? NATIONAL_TABS : TABS) as typeof NATIONAL_TABS

  useEffect(() => {
    const routeMatch = window.location.pathname.match(/^\/chapter\/([^/]+)/)
    if (routeMatch?.[1]) {
      setChapterId(decodeURIComponent(routeMatch[1]))
      return
    }
    try {
      const stored = localStorage.getItem('selectedChapterContext')
      const ctx = stored ? JSON.parse(stored) : null
      setChapterId(ctx?.chapter?.id || '')
    } catch {
      setChapterId('')
    }
  }, [])

  // Publish the bar's real height so overlays (assistant bubble, install
  // prompt) can sit above it. The bar is conditionally rendered per route, so
  // a hardcoded offset would leave a gap wherever it's absent.
  const barRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const node = barRef.current
    const root = document.documentElement
    if (!node) {
      root.style.removeProperty('--tabbar-height')
      return
    }

    const publish = () => {
      root.style.setProperty('--tabbar-height', `${Math.round(node.getBoundingClientRect().height)}px`)
    }
    publish()

    const observer = new ResizeObserver(publish)
    observer.observe(node)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--tabbar-height')
    }
  }, [])

  const resolvePath = (tab: (typeof NATIONAL_TABS)[0]) => {
    // National destinations are never chapter-scoped.
    if (tab.absolutePath) return tab.absolutePath
    if (chapterId && tab.path) return `/chapter/${encodeURIComponent(chapterId)}/${tab.path}`
    return tab.fallbackPath as string
  }

  // Hide on fullscreen pages (Kanban has its own layout)
  if (currentPage === 'kanban') return null

  return (
    <nav
      ref={barRef}
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex border-t border-white/60 bg-white/90"
      style={{
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map(tab => {
        const isActive = currentPage === tab.id
        return (
          <button
            key={tab.id}
            data-tour={tab.id}
            onClick={() => router.push(resolvePath(tab))}
            className={`flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 transition-[color] duration-150 active:scale-95 ${
              isActive ? 'text-red-600' : 'text-gray-500'
            }`}
          >
            <span className={`transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}>
              {isActive ? tab.iconFilled : tab.icon}
            </span>
            <span className={`text-[10px] font-medium tracking-tight ${isActive ? 'font-semibold' : ''}`}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
