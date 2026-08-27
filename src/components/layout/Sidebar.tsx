'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@/lib/supabase'
import { isNationalAdmin } from '@/lib/permissions'
import { ChapterBranding, getChapterBranding } from '@/lib/chapterBranding'

interface SidebarProps {
  currentPage: string
}

const NATIONAL_OVERVIEW_ITEM = {
  id: 'national-overview',
  label: 'Dashboard Nasional',
  path: '/national-overview',
  icon: 'M3 13h2l2 6 4-14 3 9 2-4h3',
}

const NATIONAL_GOVERNANCE_ITEM = {
  id: 'national-governance',
  label: 'Governance & Audit',
  path: '/national-governance',
  icon: 'M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-4z',
}

const NATIONAL_POLICY_ITEM = {
  id: 'national-policies',
  label: 'Template & Policy',
  path: '/national-policies',
  icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z',
}

const NATIONAL_API_KEYS_ITEM = {
  id: 'national-api-keys',
  label: 'API Keys',
  path: '/national-api-keys',
  icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
}

const PIC_ACCOUNTS_ITEM = {
  id: 'pic-accounts',
  label: 'Akun PIC',
  path: 'pic-accounts',
  fallbackPath: '/pic',
  icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
}

const navItems = [
  { id: 'national-dashboard', label: 'Manage Chapter', path: '/national-dashboard', icon: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zM3 14h7v7H3v-7z' },
  { id: 'master', label: 'Master Wilayah', path: '/master', icon: 'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M12 16v4' },
  { id: 'chapter-dashboard', label: 'Chapter Dashboard', path: 'dashboard', fallbackPath: '/chapter-dashboard', icon: 'M4 5h16v14H4V5zm4 4h3v6H8V9zm5 2h3v4h-3v-4z' },
  { id: 'kanban', label: 'Pipeline', path: 'pipeline', fallbackPath: '/kanban', icon: 'M3 3h5v18H3V3zm7 0h5v12h-5V3zm7 0h5v15h-5V3z' },
  { id: 'visitors', label: 'Visitor', path: 'visitors', fallbackPath: '/visitors', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 1 1 0 7.75' },
  { id: 'guests', label: 'Guest', path: 'guests', fallbackPath: '/guests', icon: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-7 18a7 7 0 0 1 14 0M19 8h3M20.5 6.5v3' },
  { id: 'attended', label: 'MCQA', path: 'mcqa', fallbackPath: '/attended', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'members', label: 'Member', path: 'members', fallbackPath: '/members', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'wa-blast', label: 'WA Blast', path: 'wa-blast', fallbackPath: '/wa-blast', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 10h8M8 14h5' },
  { id: 'export-import', label: 'Export / Import', path: 'export-import', fallbackPath: '/export-import', icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m0 0l5-5m0 5l-5-5m5 5V3' },
  { id: 'text-format', label: 'Text Format', path: 'text-format', fallbackPath: '/text-format', icon: 'M4 6h16M4 12h10M4 18h16' },
  { id: 'pic', label: 'Kelola PIC', path: 'pic', fallbackPath: '/pic', icon: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 6c-4.4 0-8 3.6-8 8h16c0-4.4-3.6-8-8-8z' },
  { id: 'weekly', label: 'Weekly Meeting', path: 'weekly', fallbackPath: '/weekly', icon: 'M3 4h18v18H3V4zm13-2v4M8 2v4M3 10h18' },
  { id: 'logs', label: 'Log', path: 'logs', fallbackPath: '/logs', icon: 'M9 11H5a2 2 0 0 0-2 2v6h6v-8zm6-6h-4a2 2 0 0 0-2 2v12h6V5zm6 4h-4a2 2 0 0 0-2 2v8h6V9z' },
]

export default function Sidebar({ currentPage }: SidebarProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [activeChapterId, setActiveChapterId] = useState('')
  const [branding, setBranding] = useState<ChapterBranding>(() => ({
    chapterName: 'BNI',
    displayName: 'BNI Chapter',
    shortName: 'BNI',
    locationLabel: '',
  }))

  const isSuperAdmin = isNationalAdmin(currentUser)
  const isNationalArea = isSuperAdmin && ['national-overview', 'national-governance', 'national-policies', 'national-api-keys', 'national-dashboard', 'master'].includes(currentPage)
  const nationalNavItems = isSuperAdmin ? [NATIONAL_OVERVIEW_ITEM, ...navItems.slice(0, 2), NATIONAL_GOVERNANCE_ITEM, NATIONAL_POLICY_ITEM, NATIONAL_API_KEYS_ITEM] : []
  const chapterNavItems = navItems.slice(2, 8)
  const dataNavItems = [
    ...navItems.slice(8).filter(item => item.id !== 'logs' || isSuperAdmin),
    ...(currentUser?.role === 'chapter_admin' ? [PIC_ACCOUNTS_ITEM] : []),
  ]

  useEffect(() => {
    let cancelled = false

    async function loadSidebarContext() {
    try {
      const storedUser = localStorage.getItem('user')
      setCurrentUser(storedUser ? JSON.parse(storedUser) : null)
      const routeMatch = window.location.pathname.match(/^\/chapter\/([^/]+)/)
      if (routeMatch?.[1]) {
        const chapterId = decodeURIComponent(routeMatch[1])
        setActiveChapterId(chapterId)
        try {
          const response = await fetch(`/api/chapter-context/${encodeURIComponent(chapterId)}`, { cache: 'no-store' })
          const context = await response.json()
          if (response.ok && context?.chapter?.id) {
            localStorage.setItem('selectedChapterContext', JSON.stringify(context))
          }
        } catch {
          // Keep existing local context if refresh fails.
        }
      } else {
        const selected = localStorage.getItem('selectedChapterContext')
        const selectedContext = selected ? JSON.parse(selected) : null
        const tenant = localStorage.getItem('tenantContext')
        const tenantContext = tenant ? JSON.parse(tenant) : null
        const user = storedUser ? JSON.parse(storedUser) : null
        setActiveChapterId(selectedContext?.chapter?.id || tenantContext?.chapter?.id || user?.chapter_id || '')
      }
      if (!cancelled) setBranding(getChapterBranding())
    } catch {
      setCurrentUser(null)
    }
    }

    loadSidebarContext()

    return () => {
      cancelled = true
    }
  }, [])

  // The quick tour needs sidebar-only entries on screen to point at them; on a
  // phone that means opening the drawer first.
  useEffect(() => {
    const open = () => setIsOpen(true)
    const close = () => setIsOpen(false)
    window.addEventListener('bni:open-sidebar', open)
    window.addEventListener('bni:close-sidebar', close)
    return () => {
      window.removeEventListener('bni:open-sidebar', open)
      window.removeEventListener('bni:close-sidebar', close)
    }
  }, [])

  const handleNavigate = (path: string) => {
    router.push(path)
    setIsOpen(false)
  }

  const resolvePath = (item: any) => {
    if (item.path?.startsWith('/')) return item.path
    return activeChapterId ? `/chapter/${encodeURIComponent(activeChapterId)}/${item.path}` : item.fallbackPath
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 flex w-64 flex-col glass-panel-strong border-r border-white/70
          transform transition-[transform] duration-200 z-50
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/60">
          <div className="inline-flex bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full mb-2 tracking-wide shadow-sm">
            {isNationalArea ? 'BNI INDONESIA' : branding.chapterName.toUpperCase()}
          </div>
          <div className="text-[17px] font-semibold text-gray-950 leading-tight tracking-[-0.01em]">
            {isNationalArea ? 'Chapter Manager' : branding.displayName}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {isNationalArea ? 'BNI Chapter Platform' : (branding.locationLabel || 'Visitor Manager')}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {/* Menu Section */}
          <div className="mb-5">
            <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider px-3 py-2 mb-1">
              MENU
            </div>
            {(isNationalArea ? nationalNavItems : chapterNavItems).map((item) => {
              const isActive = currentPage === item.id
              return (
                <button
                  key={item.id}
                  data-tour={item.id}
                  onClick={() => handleNavigate(resolvePath(item))}
                  className={`
                    relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1
                    text-[13px] font-medium transition-[background-color,color] duration-150
                    ${isActive
                      ? 'bg-red-50/90 text-red-600'
                      : 'text-gray-700 hover:bg-white/55 hover:text-gray-950'
                    }
                  `}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-red-600" />
                  )}
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive ? "2.5" : "2"}>
                    <path d={item.icon} />
                  </svg>
                  <span className={isActive ? 'font-semibold' : ''}>{item.label}</span>
                </button>
              )
            })}
          </div>

          {/* Data Section */}
          {!isNationalArea && (
          <div>
            <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider px-3 py-2 mb-1">
              DATA
            </div>
            {dataNavItems.map((item) => {
              const isActive = currentPage === item.id
              return (
                <button
                  key={item.id}
                  data-tour={item.id}
                  onClick={() => handleNavigate(resolvePath(item))}
                  className={`
                    relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1
                    text-[13px] font-medium transition-[background-color,color] duration-150
                    ${isActive
                      ? 'bg-red-50/90 text-red-600'
                      : 'text-gray-700 hover:bg-white/55 hover:text-gray-950'
                    }
                  `}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-red-600" />
                  )}
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive ? "2.5" : "2"}>
                    <path d={item.icon} />
                  </svg>
                  <span className={isActive ? 'font-semibold' : ''}>{item.label}</span>
                </button>
              )
            })}
          </div>
          )}

          {isSuperAdmin && !isNationalArea && (
            <div className="mt-5 border-t border-white/60 pt-4">
              <button
                onClick={() => handleNavigate('/national-dashboard')}
                className="w-full rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-left text-[13px] font-semibold text-red-700 transition-colors hover:bg-red-100"
              >
                Kembali ke Manage Chapter
              </button>
            </div>
          )}
        </nav>

        <div className="border-t border-white/60 px-5 py-4 space-y-2">
          <button
            onClick={() => {
              setIsOpen(false)
              window.dispatchEvent(new Event('bni:start-tour'))
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-white/60 hover:text-red-600"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.1 9a3 3 0 1 1 4.2 2.8c-.8.4-1.3 1-1.3 1.9v.3M12 17h.01" />
            </svg>
            Quick Tour
          </button>
          <a
            href="https://wit.id"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-white/60 hover:text-red-600"
          >
            <span>
              Created by <span className="font-semibold text-gray-700 group-hover:text-red-600">WIT.ID</span>
            </span>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        </div>
      </aside>

      {/* Mobile hamburger button */}
      <button 
        className="lg:hidden p-2 fixed top-3 left-3 z-50 bg-white/80 backdrop-blur-xl rounded-xl shadow-md border border-white/70"
        onClick={() => setIsOpen(true)}
      >
        <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>
    </>
  )
}
