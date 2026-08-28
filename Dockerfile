# syntax=docker/dockerfile:1

# Next.js 16 needs Node 20+; 22 is the current LTS line.
ARG NODE_VERSION=22-alpine

# --- deps -------------------------------------------------------------------
# Separate stage so the (slow) install layer is only rebuilt when the lockfile
# changes, not on every source edit.
FROM node:${NODE_VERSION} AS deps
# sharp (Next's image optimizer) links against glibc; alpine needs the shim.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- builder ----------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The app must build without credentials: demo mode is the fallback when the
# Supabase vars are absent, and that is exactly the state of a CI build.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runner -----------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user; the image never needs write access to its own files.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# public/ and .next/static are not bundled into standalone — they are served
# from disk and must be copied separately.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# No shell wrapper: node is PID 1 so it receives SIGTERM directly and the
# container stops promptly instead of waiting out the kill timeout.
CMD ["node", "server.js"]
