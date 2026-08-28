/**
 * Registers the service worker. Kept out of main.tsx so a registration failure
 * (an unsupported browser, a blocked scope) never stops the app from rendering.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.error('Service worker gagal didaftarkan:', error)
    })
  })
}
