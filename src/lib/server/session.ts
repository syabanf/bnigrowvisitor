import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { DEMO_SESSION_SECRET, isDemoMode } from './demo/config'

export const SESSION_COOKIE = 'bni_session'
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

export interface SessionPayload {
  sub: string
  email: string
  role: string
  chapter_id?: string | null
  organization_id?: string | null
  exp: number
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (secret) return secret
  // Demo mode has no service-role key to borrow, so it signs with a fixed
  // constant. Safe only because demo data is fabricated and disposable.
  if (isDemoMode()) return DEMO_SESSION_SECRET
  throw new Error('SESSION_SECRET atau SUPABASE_SERVICE_ROLE_KEY wajib diset untuk sesi login.')
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function sign(data: string): string {
  return createHmac('sha256', getSessionSecret()).update(data).digest('base64url')
}

export function createSessionToken(
  payload: Omit<SessionPayload, 'exp'>,
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS
): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  }
  const encoded = base64UrlEncode(JSON.stringify(fullPayload))
  return `${encoded}.${sign(encoded)}`
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null

  const separatorIndex = token.lastIndexOf('.')
  if (separatorIndex <= 0) return null

  const encoded = token.slice(0, separatorIndex)
  const signature = token.slice(separatorIndex + 1)
  const expected = sign(encoded)

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (signatureBuffer.length !== expectedBuffer.length) return null
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as SessionPayload
    if (!payload.sub || typeof payload.exp !== 'number') return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)
}

export function sessionCookieOptions(maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  }
}
