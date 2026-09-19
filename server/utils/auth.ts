import type { H3Event } from 'h3'
import { randomToken, tokenHash, type D1DatabaseLike } from './anonymousTrips'

export const SESSION_COOKIE = 'orlando_session'

export interface AuthUser {
  id: string
  email: string
  displayName: string
  globalRole: 'user' | 'agent' | 'admin'
}

interface SessionRow {
  session_id: string
  user_id: string
  email: string
  display_name: string
  global_role: AuthUser['globalRole']
  expires_at: string
}

export function requireAuthDb(event: H3Event): D1DatabaseLike {
  const config = useRuntimeConfig(event)
  if (!config.authEnabled) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const db = (event.context as any).cloudflare?.env?.ORLANDO_DB as D1DatabaseLike | undefined
  if (!db?.batch) throw createError({ statusCode: 503, statusMessage: 'Account service unavailable' })
  return db
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw createError({ statusCode: 400, statusMessage: 'Enter a valid email address', data: { code: 'invalid_email' } })
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Enter a valid email address', data: { code: 'invalid_email' } })
  }
  return email
}

export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/trips'
  return value.slice(0, 500)
}

export function assertSameOrigin(event: H3Event): void {
  const origin = getHeader(event, 'origin')
  const expected = getRequestURL(event).origin
  if (!origin || origin !== expected) throw createError({ statusCode: 403, statusMessage: 'Invalid request origin', data: { code: 'invalid_origin' } })
}

export async function enforceAuthRateLimit(event: H3Event, db: D1DatabaseLike, email?: string): Promise<void> {
  const config = useRuntimeConfig(event)
  const secret = String(config.authRateLimitSecret)
  if (!secret) throw createError({ statusCode: 503, statusMessage: 'Account service unavailable' })
  const now = new Date()
  const windowStartedAt = `${now.toISOString().slice(0, 13)}:00:00.000Z`
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const identities = [[`ip:${ip}`, 20], ...(email ? [[`email:${email}`, 6] as [string, number]] : [])] as Array<[string, number]>
  for (const [identity, limit] of identities) {
    const bucket = await tokenHash(`${secret}:${identity}:${windowStartedAt}`)
    await db.prepare("INSERT INTO rate_limit_buckets (bucket_hash, scope, requests, window_started_at, updated_at) VALUES (?, 'auth-magic', 1, ?, ?) ON CONFLICT(scope, bucket_hash) DO UPDATE SET requests = requests + 1, updated_at = excluded.updated_at").bind(bucket, windowStartedAt, now.toISOString()).run()
    const row = await db.prepare("SELECT requests FROM rate_limit_buckets WHERE scope = 'auth-magic' AND bucket_hash = ?").bind(bucket).first<{ requests: number }>()
    if ((row?.requests ?? 0) > limit) throw createError({ statusCode: 429, statusMessage: 'Try again later', data: { code: 'rate_limited' } })
  }
}

function sessionCookieOptions(event: H3Event, maxAge?: number) {
  return {
    httpOnly: true,
    secure: getRequestURL(event).protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',
    ...(maxAge === undefined ? {} : { maxAge }),
  }
}

export function setSessionCookie(event: H3Event, token: string, days: number): void {
  setCookie(event, SESSION_COOKIE, token, sessionCookieOptions(event, days * 86_400))
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, sessionCookieOptions(event, 0))
}

export async function currentSession(event: H3Event, db = requireAuthDb(event)): Promise<{ user: AuthUser; sessionId: string } | null> {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return null
  const hash = await tokenHash(token)
  const now = new Date().toISOString()
  const row = await db.prepare('SELECT s.id AS session_id, u.id AS user_id, u.email, u.display_name, u.global_role, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.deleted_at IS NULL').bind(hash, now).first<SessionRow>()
  if (!row) {
    clearSessionCookie(event)
    return null
  }
  await db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').bind(now, row.session_id).run()
  return {
    sessionId: row.session_id,
    user: { id: row.user_id, email: row.email, displayName: row.display_name, globalRole: row.global_role },
  }
}

export async function requireSession(event: H3Event, db = requireAuthDb(event)): Promise<{ user: AuthUser; sessionId: string }> {
  const session = await currentSession(event, db)
  if (!session) throw createError({ statusCode: 401, statusMessage: 'Sign in required', data: { code: 'authentication_required' } })
  return session
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

export async function deliverMagicLink(event: H3Event, email: string, token: string, redirectPath: string): Promise<{ devLink?: string }> {
  const config = useRuntimeConfig(event)
  const baseUrl = String(config.appBaseUrl || getRequestURL(event).origin).replace(/\/$/, '')
  const link = `${baseUrl}/auth/verify#token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(redirectPath)}`
  const branch = String((event.context as any).cloudflare?.env?.CF_PAGES_BRANCH || '')
  if (config.authDevExposeLinks && branch !== 'main') return { devLink: link }

  const apiKey = String(config.resendApiKey)
  const from = String(config.authEmailFrom)
  if (!apiKey || !from) throw createError({ statusCode: 503, statusMessage: 'Email delivery unavailable', data: { code: 'email_unavailable' } })
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `magic-link/${await tokenHash(token)}` },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Sign in to Orlando Planner',
      html: `<p>Use this one-time link to sign in to Orlando Planner. It expires soon.</p><p><a href="${escapeHtml(link)}">Sign in to Orlando Planner</a></p><p>If you did not request this, you can ignore this email.</p>`,
    }),
  })
  if (!response.ok) throw createError({ statusCode: 503, statusMessage: 'Email delivery unavailable', data: { code: 'email_unavailable' } })
  return {}
}

const REVOKED_SESSION_PURGE_DAYS = 7

export async function purgeExpiredAuthData(db: D1DatabaseLike, now = new Date()): Promise<void> {
  const expiredCutoff = now.toISOString()
  const revokedCutoff = new Date(now.getTime() - REVOKED_SESSION_PURGE_DAYS * 86_400_000).toISOString()
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at <= ? OR (revoked_at IS NOT NULL AND revoked_at <= ?)').bind(expiredCutoff, revokedCutoff),
    db.prepare('DELETE FROM auth_tokens WHERE expires_at <= ? AND (used_at IS NOT NULL OR purpose != \'magic_link\')').bind(expiredCutoff),
    db.prepare('DELETE FROM trip_capabilities WHERE revoked_at IS NOT NULL AND revoked_at <= ?').bind(revokedCutoff),
  ])
}

export async function createSession(event: H3Event, db: D1DatabaseLike, userId: string): Promise<string> {
  const config = useRuntimeConfig(event)
  const days = Math.min(90, Math.max(1, Number(config.authSessionDays) || 30))
  const token = randomToken()
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString()
  await db.prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(`session-${randomToken()}`, userId, await tokenHash(token), expiresAt, now, now).run()
  setSessionCookie(event, token, days)
  return token
}

// ── OAuth / PKCE helpers ─────────────────────────────────────────────────────

const OAUTH_STATE_COOKIE = 'orlando_oauth_state'
const OAUTH_VERIFIER_COOKIE = 'orlando_oauth_verifier'

export function oauthStateCookieOptions(event: H3Event, maxAge: number) {
  return {
    httpOnly: true,
    secure: getRequestURL(event).protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}

export function setOAuthStateCookie(event: H3Event, state: string): void {
  setCookie(event, OAUTH_STATE_COOKIE, state, oauthStateCookieOptions(event, 600))
}

export function getOAuthState(event: H3Event): string {
  return getCookie(event, OAUTH_STATE_COOKIE) ?? ''
}

export function clearOAuthCookies(event: H3Event): void {
  deleteCookie(event, OAUTH_STATE_COOKIE, oauthStateCookieOptions(event, 0))
  deleteCookie(event, OAUTH_VERIFIER_COOKIE, oauthStateCookieOptions(event, 0))
}

export function setCodeVerifierCookie(event: H3Event, verifier: string): void {
  setCookie(event, OAUTH_VERIFIER_COOKIE, verifier, oauthStateCookieOptions(event, 600))
}

export function getCodeVerifier(event: H3Event): string {
  return getCookie(event, OAUTH_VERIFIER_COOKIE) ?? ''
}

export async function generateCodeVerifier(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  // RFC 7636 requires the SHA-256 digest to be base64url-encoded for the
  // S256 challenge. A hexadecimal digest has the wrong representation and
  // causes Google's token exchange to reject the otherwise valid code.
  let binary = ''
  for (const byte of new Uint8Array(hash)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function googleRedirectUri(event: H3Event): string {
  const config = useRuntimeConfig(event)
  const base = String(config.appBaseUrl || getRequestURL(event).origin).replace(/\/$/, '')
  return `${base}/api/auth/google/callback`
}
