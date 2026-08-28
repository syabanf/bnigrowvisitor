import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // The API is proxied rather than called cross-origin so the session cookie
    // is same-site in development, exactly as it will be in production behind
    // one hostname. Without this the cookie would be third-party and dropped.
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
