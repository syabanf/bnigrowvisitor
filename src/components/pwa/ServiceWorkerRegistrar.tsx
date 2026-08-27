'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

// Chrome fires this with a prompt() we're allowed to call later; it isn't in
// lib.dom yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa-install-dismissed'

export default function ServiceWorkerRegistrar() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.error('Service worker gagal didaftarkan:', error)
    })
  }, [])

  useEffect(() => {
    const onPrompt = (event: Event) => {
      // Suppress Chrome's own mini-infobar so the in-app button is the single
      // install affordance.
      event.preventDefault()
      try {
        if (localStorage.getItem(DISMISS_KEY) === '1') return
      } catch {}
      setInstallEvent(event as BeforeInstallPromptEvent)
    }

    const onInstalled = () => setInstallEvent(null)

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {}
    setInstallEvent(null)
  }

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice
    setInstallEvent(null)
  }

  if (!installEvent) return null

  return (
    <div
      className="fixed inset-x-3 z-[2147481000] flex items-center gap-3 rounded-2xl border border-white/70 bg-white/95 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:left-auto sm:right-4 sm:w-80"
      // Above the assistant bubble (which tops out around 8rem) in both layouts.
      style={{ bottom: 'calc(5rem + var(--tabbar-height, 0px) + env(safe-area-inset-bottom))' }}
      role="dialog"
      aria-label="Pasang aplikasi"
    >
      <Image src="/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 flex-shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-gray-950">Pasang aplikasi</div>
        <div className="truncate text-xs text-gray-500">Akses lebih cepat, tampil layar penuh.</div>
      </div>
      <button
        onClick={dismiss}
        className="rounded-xl px-2 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100"
      >
        Nanti
      </button>
      <button
        onClick={install}
        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
      >
        Pasang
      </button>
    </div>
  )
}
