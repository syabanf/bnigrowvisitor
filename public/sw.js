// BNI Visitor Management — service worker.
//
// Caching rules are deliberately conservative. This is a multi-tenant app behind
// auth, so anything that could hold one chapter's (or one account's) data is
// never written to the cache:
//
//   /api/*        bypassed entirely — live, tenant-scoped, session-dependent
//   navigations   network-first, cache only as an offline fallback shell
//   static assets cache-first, but only content-hashed build output and icons
//
// On localhost everything falls back to network-first so the dev server's HMR
// output is never served stale.

const VERSION = 'v1'
const SHELL_CACHE = `bni-shell-${VERSION}`
const ASSET_CACHE = `bni-assets-${VERSION}`
const OFFLINE_URL = '/offline.html'

const PRECACHE = [OFFLINE_URL, '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']

const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1'

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

// Content-hashed build output and our own icons are safe to serve from cache.
function isImmutableAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icon-') ||
    url.pathname === '/apple-touch-icon.png' ||
    url.pathname === '/favicon.ico'
  )
}

async function networkFirst(request, fallbackToOffline) {
  try {
    const response = await fetch(request)
    if (fallbackToOffline && response.ok) {
      // Keep only the most recent successful shell so offline has something to
      // render. Responses here are client-rendered shells, not data payloads.
      const cache = await caches.open(SHELL_CACHE)
      cache.put(OFFLINE_URL, (await caches.match(OFFLINE_URL)) || response.clone())
    }
    return response
  } catch (error) {
    const cached = await caches.match(request)
    if (cached) return cached
    if (fallbackToOffline) {
      const offline = await caches.match(OFFLINE_URL)
      if (offline) return offline
    }
    throw error
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', event => {
  const { request } = event

  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never let API traffic touch the cache, in either direction.
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, true))
    return
  }

  if (!isDev && isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request))
    return
  }

  event.respondWith(networkFirst(request, false))
})
