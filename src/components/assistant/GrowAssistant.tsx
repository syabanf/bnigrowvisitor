'use client'

import { useEffect, useRef, useState } from 'react'
import { useChapterBranding } from '@/hooks/useChapterBranding'

type AssistantMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const starterPrompts = [
  'Buat prioritas follow-up hari ini',
  'Tampilkan data yang belum lengkap',
  'Analisa conversion funnel',
  'Siapa top visitor brought?',
]

const actionShortcuts = [
  { label: 'Buka Visitor', path: 'visitors', fallbackPath: '/visitors' },
  { label: 'Buka MCQA', path: 'mcqa', fallbackPath: '/attended' },
  { label: 'Text Format WA', path: 'text-format', fallbackPath: '/text-format' },
]

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getStoredUserId() {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return ''
    const user = JSON.parse(raw)
    return typeof user?.id === 'string' ? user.id : ''
  } catch {
    return ''
  }
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function isNationalAdminUser(user: any) {
  if (!user) return false
  return user.role === 'national_admin' || user.role === 'admin' || user.email === 'admin@bniindonesia.com'
}

function normalizeAssistantText(value: string) {
  return value
    .replace(/\*\*/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const POSITION_STORAGE_KEY = 'grow-assistant-position'
const BUBBLE_WIDTH = 230
const BUBBLE_HEIGHT = 64
const VIEWPORT_PADDING = 16

// The constants are only fallbacks for the first paint; once the bubble is in
// the DOM its measured box is used, because the hardcoded width was ~27px wider
// than the rendered pill and left a visible gap at the right edge.
function clampPosition(
  position: { x: number; y: number },
  size?: { width: number; height: number }
) {
  if (typeof window === 'undefined') return position

  const width = size?.width || BUBBLE_WIDTH
  const height = size?.height || BUBBLE_HEIGHT

  return {
    x: Math.min(Math.max(VIEWPORT_PADDING, position.x), Math.max(VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING)),
    y: Math.min(Math.max(VIEWPORT_PADDING, position.y), Math.max(VIEWPORT_PADDING, window.innerHeight - height - VIEWPORT_PADDING)),
  }
}

export default function GrowAssistant() {
  const chapterBranding = useChapterBranding()
  const chapterRouteMatch = typeof window !== 'undefined' ? window.location.pathname.match(/^\/chapter\/([^/]+)/) : null
  const isNationalScope = !chapterRouteMatch && typeof window !== 'undefined' && isNationalAdminUser(getStoredUser())
  const activeChapterId = chapterRouteMatch?.[1]
    ? decodeURIComponent(chapterRouteMatch[1])
    : (isNationalScope ? '' : chapterBranding.chapterId)
  const assistantName = isNationalScope ? 'BNI Assistant' : `${chapterBranding.shortName} Assistant`
  const assistantInitials = isNationalScope ? 'BA' : `${chapterBranding.shortName.charAt(0) || 'G'}A`.toUpperCase()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isOnline, setIsOnline] = useState<boolean | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  // Phones get a pinned, icon-only bubble instead of the draggable desktop pill:
  // a 230px-wide draggable card eats most of a 375px viewport, and a position
  // saved on desktop would land it somewhere useless after a resize.
  const [isCompact, setIsCompact] = useState(false)
  const bubbleRef = useRef<HTMLButtonElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: isNationalScope
        ? `Halo, saya ${assistantName}. Saya bisa bantu analisa data visitor, member, PIC, dan meeting dari semua chapter BNI.`
        : `Halo, saya ${assistantName}. Saya bisa bantu baca data visitor, status follow-up, PIC, meeting, top referral, dan insight dashboard ${chapterBranding.chapterName}.`,
    },
  ])
  const listRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({
    pointerId: 0,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    moved: false,
    suppressClick: false,
  })

  useEffect(() => {
    // Matches MobileTabBar's `lg:hidden`: wherever the tab bar exists, the
    // bubble is pinned above it instead of floating free.
    const query = window.matchMedia('(max-width: 1023px)')
    const sync = () => setIsCompact(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const box = bubbleRef.current?.getBoundingClientRect()
    const size = box ? { width: box.width, height: box.height } : undefined
    const width = size?.width || BUBBLE_WIDTH
    const height = size?.height || BUBBLE_HEIGHT

    const defaultPosition = {
      x: window.innerWidth - width - VIEWPORT_PADDING,
      y: window.innerHeight - height - VIEWPORT_PADDING,
    }

    try {
      const saved = localStorage.getItem(POSITION_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          setPosition(clampPosition(parsed, size))
          return
        }
      }
    } catch {
      // Ignore invalid saved positions and use the default.
    }

    setPosition(clampPosition(defaultPosition, size))
  }, [])

  useEffect(() => {
    setMessages(prev => prev.map(message =>
      message.id === 'welcome'
        ? {
            ...message,
            content: isNationalScope
              ? `Halo, saya ${assistantName}. Saya bisa bantu analisa data visitor, member, PIC, dan meeting dari semua chapter BNI.`
              : `Halo, saya ${assistantName}. Saya bisa bantu baca data visitor, status follow-up, PIC, meeting, top referral, dan insight dashboard ${chapterBranding.chapterName}.`,
          }
        : message
    ))
  }, [assistantName, chapterBranding.chapterName, isNationalScope])

  useEffect(() => {
    // Clamp in memory only. Persisting here meant that merely narrowing the
    // window rewrote the saved position to the narrow viewport's right edge,
    // so the bubble drifted left for good and never returned to the corner
    // when the window was widened again. Only a real drag should persist.
    const handleResize = () => {
      const box = bubbleRef.current?.getBoundingClientRect()
      const size = box ? { width: box.width, height: box.height } : undefined
      setPosition(prev => clampPosition(prev, size))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isOpen])

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim()
    if (!content || isSending) return

    const userMessage: AssistantMessage = {
      id: createId(),
      role: 'user',
      content,
    }
    const nextMessages = [...messages, userMessage]

    setMessages(nextMessages)
    setInput('')
    setIsOpen(true)
    setIsSending(true)

    try {
      const response = await fetch('/api/grow-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: getStoredUserId(),
          chapterId: activeChapterId,
          assistantName,
          chapterName: chapterBranding.chapterName,
          messages: nextMessages.map(message => ({
            role: message.role,
            content: message.role === 'user'
              ? `${message.content}\n\nJawab natural tanpa markdown, tanpa tanda **, tanpa menyebut sumber, dan akhiri dengan pertanyaan singkat apa lagi yang bisa dibantu.`
              : message.content,
          })),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || `${assistantName} belum bisa menjawab.`)
      }

      setIsOnline(true)
      setMessages(prev => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          content: normalizeAssistantText(data.answer || 'Saya belum menemukan jawaban yang pas dari data dashboard. Ada lagi yang bisa saya bantu?'),
        },
      ])
    } catch (error: any) {
      setIsOnline(false)
      setMessages(prev => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          content: normalizeAssistantText(error.message || `Maaf, ${assistantName} sedang offline atau bermasalah. Coba lagi sebentar.`),
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialX: position.x,
      initialY: position.y,
      moved: false,
      suppressClick: false,
    }
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging || dragRef.current.pointerId !== event.pointerId) return

    const deltaX = event.clientX - dragRef.current.startX
    const deltaY = event.clientY - dragRef.current.startY

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      dragRef.current.moved = true
      dragRef.current.suppressClick = true
    }

    const next = clampPosition({
      x: dragRef.current.initialX + deltaX,
      y: dragRef.current.initialY + deltaY,
    })

    setPosition(next)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current.pointerId === event.pointerId) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {}

      if (dragRef.current.moved) {
        try {
          localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position))
        } catch {}
      }
    }

    setIsDragging(false)
  }

  const handleBubbleClick = () => {
    if (dragRef.current.suppressClick) {
      dragRef.current.suppressClick = false
      return
    }

    setIsOpen(prev => !prev)
  }

  const panelVerticalClass = isCompact || position.y > 360
    ? 'bottom-[calc(100%+1rem)]'
    : 'top-[calc(100%+1rem)]'
  const panelHorizontalClass = isCompact || position.x > 260 ? 'right-0' : 'left-0'
  const resolveShortcutPath = (action: (typeof actionShortcuts)[number]) =>
    activeChapterId ? `/chapter/${encodeURIComponent(activeChapterId)}/${action.path}` : action.fallbackPath

  return (
    <div
      className="fixed z-[2147482000]"
      style={
        isCompact
          ? {
              // Anchored, not computed: stays glued to the bottom-right corner
              // and clears the iOS home indicator in standalone PWA mode.
              right: 'calc(1rem + env(safe-area-inset-right))',
              // Rides on the tab bar's published height (0 on routes that don't
              // render one) plus the iOS home-indicator inset.
              bottom: 'calc(1rem + var(--tabbar-height, 0px) + env(safe-area-inset-bottom))',
            }
          : { left: position.x || undefined, top: position.y || undefined }
      }
    >
      {isOpen && (
        <div className={`absolute ${panelVerticalClass} ${panelHorizontalClass} flex h-[min(640px,calc(100vh-7rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/92 shadow-[0_24px_80px_rgba(15,23,42,0.22)] backdrop-blur-2xl`}>
          <div className="flex items-center justify-between border-b border-gray-100 bg-white/80 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-red-800 text-sm font-bold text-white shadow-lg shadow-red-900/20">
                {assistantInitials}
              </div>
              <div>
                <div className="text-sm font-bold text-gray-950">{assistantName}</div>
                <div className={`flex items-center gap-1.5 text-xs font-medium ${isOnline === false ? 'text-gray-500' : 'text-emerald-600'}`}>
                  <span className={`h-2 w-2 rounded-full ${isOnline === false ? 'bg-gray-400' : 'bg-emerald-500'}`} />
                  {isOnline === false ? 'Offline' : 'Online'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label={`Tutup ${assistantName}`}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-gray-50/80 to-white px-4 py-4">
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[86%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-red-600 text-white shadow-lg shadow-red-900/10'
                      : 'border border-gray-100 bg-white text-gray-800 shadow-sm'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
                  {assistantName} sedang membaca data...
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 bg-white p-3">
            <div className="mb-2 flex gap-2 overflow-x-auto">
              {actionShortcuts.map(action => (
                <button
                  key={action.path}
                  onClick={() => {
                    window.location.href = resolveShortcutPath(action)
                    setIsOpen(false)
                  }}
                  className="whitespace-nowrap rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
                >
                  {action.label}
                </button>
              ))}
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              {starterPrompts.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={isSending}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                sendMessage()
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    sendMessage()
                  }
                }}
                rows={1}
                placeholder={`Tanya ${assistantName}...`}
                className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:border-red-300 focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Kirim pesan"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        ref={bubbleRef}
        data-tour="assistant"
        onClick={handleBubbleClick}
        onPointerDown={isCompact ? undefined : handlePointerDown}
        onPointerMove={isCompact ? undefined : handlePointerMove}
        onPointerUp={isCompact ? undefined : handlePointerUp}
        onPointerCancel={isCompact ? undefined : handlePointerUp}
        className={`group flex touch-none select-none items-center justify-center bg-gradient-to-br from-red-600 via-red-700 to-red-900 text-white shadow-[0_18px_50px_rgba(185,28,28,0.35)] ring-1 ring-white/20 transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(185,28,28,0.42)] ${
          isCompact
            ? 'h-14 w-14 rounded-full'
            : `h-16 gap-3 rounded-2xl px-4 pr-5 ${isDragging ? 'cursor-grabbing scale-[1.02]' : 'cursor-grab'}`
        }`}
        aria-label={`Buka ${assistantName}`}
        title={isCompact ? `Buka ${assistantName}` : 'Klik untuk buka, drag untuk pindahkan posisi'}
      >
        {isOpen ? (
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <>
            <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.16] text-sm font-black shadow-inner ring-1 ring-white/25">
              {assistantInitials}
              <span className={`absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-red-700 ${isOnline === false ? 'bg-gray-300' : 'bg-emerald-300'}`} />
            </span>
            {!isCompact && (
              <span className="text-left leading-tight">
                <span className="block text-sm font-black tracking-wide">{assistantName}</span>
                <span className="block text-[11px] font-semibold text-white/75">Tanya data visitor</span>
              </span>
            )}
          </>
        )}
      </button>
    </div>
  )
}
