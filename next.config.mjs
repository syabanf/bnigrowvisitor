/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits .next/standalone: a self-contained server with only the packages it
  // actually imports, so the runtime image doesn't need node_modules at all.
  output: 'standalone',
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
  },
}

export default nextConfig
