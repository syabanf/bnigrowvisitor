'use client'

import { useEffect, useRef, useState } from 'react'
import { User } from '@/lib/supabase'
import { getUserLevelLabel, isNationalAdmin } from '@/lib/permissions'
import { ChapterBranding, getChapterBranding } from '@/lib/chapterBranding'

interface TopbarProps {
  title: string
  user: User | null
  onLogout: () => void
  onAddVisitor: () => void
  showAddVisitor?: boolean
  isScrolled?: boolean
}

export default function Topbar({ title, user, onLogout, onAddVisitor, showAddVisitor = true, isScrolled = false }: TopbarProps) {
  const [branding, setBranding] = useState<ChapterBranding>(() => ({
    chapterName: 'BNI',
    displayName: 'BNI Chapter',
    shortName: 'BNI',
    locationLabel: '',
  }))
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const levelLabel = getUserLevelLabel(user)
  const isChapterRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/chapter/')
  const profileName = isNationalAdmin(user) && isChapterRoute
    ? `Admin ${branding.chapterName}`
    : user?.name
  const scopeLabel = isNationalAdmin(user) && isChapterRoute
    ? [branding.locationLabel, branding.displayName].filter(Boolean).join(' / ')
    : isNationalAdmin(user)
      ? (user?.organization_name || 'BNI Indonesia')
      : [user?.city_name, user?.area_name, user?.chapter_display_name || user?.chapter_name]
        .filter(Boolean)
        .join(' / ')

  useEffect(() => {
    let cancelled = false

    async function loadBranding() {
      const routeMatch = window.location.pathname.match(/^\/chapter\/([^/]+)/)
      if (routeMatch?.[1]) {
        const chapterId = decodeURIComponent(routeMatch[1])
        try {
          const response = await fetch(`/api/chapter-context/${encodeURIComponent(chapterId)}`, { cache: 'no-store' })
          const context = await response.json()
          if (response.ok && context?.chapter?.id) {
            localStorage.setItem('selectedChapterContext', JSON.stringify(context))
          }
        } catch {
          // Keep existing local context if refresh fails.
        }
      }

      if (!cancelled) setBranding(getChapterBranding())
    }

    loadBranding()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    if (profileOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [profileOpen])

  return (
    <header
      className={`sticky top-0 z-30 h-[58px] border-b shadow-sm transition-[background-color,border-color] duration-300
        ${isScrolled
          ? 'bg-white/90 border-gray-200/70 backdrop-blur-xl'
          : 'bg-white/62 border-white/65 backdrop-blur-2xl'
        }`}
    >
      <div className="relative h-full px-4 lg:px-6 flex items-center">

        {/* Desktop: title + breadcrumb */}
        <div className="hidden lg:flex flex-col justify-center flex-1 min-w-0">
          <h1 className="text-[17px] font-semibold text-gray-950 tracking-[-0.01em] leading-tight">{title}</h1>
          {scopeLabel && (
            <p className="text-[11px] text-gray-400 leading-tight mt-0.5 truncate max-w-xs">{scopeLabel}</p>
          )}
        </div>

        {/* Mobile: compact title fades in when large title scrolls out */}
        <h1
          className={`lg:hidden absolute inset-x-0 text-center px-24 text-[15px] font-semibold text-gray-950 tracking-[-0.01em] truncate pointer-events-none transition-opacity duration-200 ${isScrolled ? 'opacity-100' : 'opacity-0'}`}
        >
          {title}
        </h1>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">

          <button
            onClick={() => window.dispatchEvent(new Event('bni:start-tour'))}
            aria-label="Mulai quick tour"
            title="Quick Tour"
            className="inline-flex h-9 items-center gap-1.5 px-2.5 rounded-xl border border-gray-200/80 bg-white/70 text-sm font-semibold text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.1 9a3 3 0 1 1 4.2 2.8c-.8.4-1.3 1-1.3 1.9v.3M12 17h.01" />
            </svg>
            <span className="hidden md:inline">Tour</span>
          </button>

          {showAddVisitor && (
            <button
              onClick={onAddVisitor}
              className="inline-flex h-9 items-center gap-1.5 px-3 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="hidden sm:inline">Tambah Visitor</span>
            </button>
          )}

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(v => !v)}
              className="flex items-center gap-2 pl-2 lg:pl-3 lg:border-l lg:border-gray-200/70"
            >
              <div className="text-right hidden lg:block">
                <div className="text-[13px] font-semibold text-gray-950 leading-4 tracking-[-0.01em]">{profileName}</div>
                <div className="text-[11px] text-gray-500 leading-4">{levelLabel}</div>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-red-800 text-white flex items-center justify-center text-sm font-bold shadow-md ring-2 ring-white/70 flex-shrink-0">
                {profileName?.charAt(0).toUpperCase() || 'U'}
              </div>
            </button>

            {/* Glass profile dropdown */}
            {profileOpen && (
              <div className="modal-spring-enter absolute right-0 top-full mt-2 w-64 rounded-2xl border border-white/60 bg-white/85 backdrop-blur-xl shadow-2xl z-50 overflow-hidden">
                {/* User card */}
                <div className="px-4 py-3.5 border-b border-white/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-800 text-white flex items-center justify-center text-sm font-bold shadow-sm flex-shrink-0">
                      {profileName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-gray-950 leading-5 truncate">{profileName}</div>
                      <div className="text-[11px] text-gray-500 leading-4">{levelLabel}</div>
                      {scopeLabel && (
                        <div className="text-[11px] text-gray-400 leading-4 truncate">{scopeLabel}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="py-1">
                  <a
                    href="/my-account"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-[13px] font-medium text-gray-700 hover:bg-white/60 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                      </svg>
                    </span>
                    <span>Profil Akun</span>
                  </a>

                  <div className="mx-4 my-1 border-t border-gray-100/70" />

                  <button
                    onClick={() => { setProfileOpen(false); onLogout() }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium text-red-600 hover:bg-red-50/60 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                      </svg>
                    </span>
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
