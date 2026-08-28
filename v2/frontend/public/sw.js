// Service worker for the Vite build.
//
// The caching rules are deliberately narrow. This is a multi-tenant app behind
// auth, so /api/ is bypassed entirely: caching it risks serving one chapter's
// data to another, or showing a signed-out user the previous session's records.

const VERSION = 'v1'
const SHELL = `bni-v2-shell-${VERSION}`
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL)
      .then(cache => cache.addAll([OFFLINE_URL, '/icon-192.png']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never cache API traffic, in either direction.
  if (url.pathname.startsWith('/api/')) return

  // Vite emits content-hashed asset filenames, so those are safe to serve from
  // cache indefinitely. Everything else goes to the network first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(hit => hit || fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(SHELL).then(cache => cache.put(request, copy))
        }
        return response
      })),
    )
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    )
  }
})
