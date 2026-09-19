import {
  clearOAuthCookies,
  createSession,
  getCodeVerifier,
  getOAuthRedirect,
  getOAuthState,
  googleRedirectUri,
  normalizeEmail,
  requireAuthDb,
} from '../../../utils/auth'
import { randomToken, tokenHash } from '../../../utils/anonymousTrips'

interface GoogleTokenResponse {
  access_token: string
  id_token: string
  token_type: string
  expires_in: number
}

interface GoogleUserInfo {
  sub: string
  email: string
  email_verified: boolean
  name: string
  picture?: string
}

interface ExistingUser {
  id: string
  email: string
  email_normalized: string
  display_name: string
  global_role: 'user' | 'agent' | 'admin'
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const clientId = String(config.googleClientId)
  const clientSecret = String(config.googleClientSecret)
  if (!clientId || !clientSecret) throw createError({ statusCode: 503, statusMessage: 'Google sign-in unavailable', data: { code: 'google_disabled' } })

  const db = requireAuthDb(event)

  // ── Validate state ─────────────────────────────────────────────────────────
  const query = getQuery(event)
  const returnedState = typeof query.state === 'string' ? query.state : ''
  const savedState = getOAuthState(event)
  const redirectPath = getOAuthRedirect(event)
  clearOAuthCookies(event)
  if (!returnedState || !savedState || returnedState !== savedState) {
    throw createError({ statusCode: 400, statusMessage: 'Sign-in session expired or invalid', data: { code: 'invalid_oauth_state' } })
  }

  // ── Validate authorization code ────────────────────────────────────────────
  const code = typeof query.code === 'string' ? query.code : ''
  if (!code) {
    const error = typeof query.error === 'string' ? query.error : 'unknown'
    throw createError({ statusCode: 400, statusMessage: `Google sign-in was denied: ${error}`, data: { code: 'oauth_denied', detail: error } })
  }

  // ── Exchange code for tokens ───────────────────────────────────────────────
  const verifier = getCodeVerifier(event)
  const redirectUri = googleRedirectUri(event)

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  })

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text()
    throw createError({ statusCode: 502, statusMessage: 'Google token exchange failed', data: { code: 'token_exchange_failed', detail: body.slice(0, 200) } })
  }

  const tokens: GoogleTokenResponse = await tokenResponse.json()

  // ── Fetch user info ────────────────────────────────────────────────────────
  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  if (!userInfoResponse.ok) {
    throw createError({ statusCode: 502, statusMessage: 'Could not fetch Google profile', data: { code: 'userinfo_failed' } })
  }

  const googleUser: GoogleUserInfo = await userInfoResponse.json()
  if (!googleUser.email || !googleUser.email_verified) {
    throw createError({ statusCode: 400, statusMessage: 'Google account email is not verified', data: { code: 'unverified_email' } })
  }

  const email = normalizeEmail(googleUser.email)
  const displayName = googleUser.name || email.split('@')[0]
  const now = new Date().toISOString()

  // ── Upsert user ────────────────────────────────────────────────────────────
  const proposedUserId = `user-${randomToken()}`
  await db.prepare('INSERT INTO users (id, email, email_normalized, display_name, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(email_normalized) DO NOTHING').bind(proposedUserId, email, email, displayName, now, now, now).run()
  const user = await db.prepare('SELECT id, email, display_name, global_role FROM users WHERE email_normalized = ? AND deleted_at IS NULL').bind(email).first<ExistingUser>()
  if (!user) throw createError({ statusCode: 403, statusMessage: 'Account unavailable', data: { code: 'account_unavailable' } })

  // ── Upsert Google identity ─────────────────────────────────────────────────
  const identityId = `identity-${randomToken()}`
  await db.prepare('INSERT INTO auth_identities (id, user_id, provider, provider_subject, created_at) VALUES (?, ?, \'google\', ?, ?) ON CONFLICT(provider, provider_subject) DO NOTHING').bind(identityId, user.id, googleUser.sub, now).run()

  // ── Create session ─────────────────────────────────────────────────────────
  await createSession(event, db, user.id)

  return sendRedirect(event, redirectPath)
})
