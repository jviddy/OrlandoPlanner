import { deliverMagicLink, enforceAuthRateLimit, normalizeEmail, requireAuthDb, safeRedirect } from '../../utils/auth'
import { randomToken, tokenHash } from '../../utils/anonymousTrips'

export default defineEventHandler(async (event) => {
  const db = requireAuthDb(event)
  const body = await readBody(event)
  const email = normalizeEmail(body?.email)
  const redirectPath = safeRedirect(body?.redirectPath)
  await enforceAuthRateLimit(event, db, email)
  const token = randomToken()
  const now = new Date().toISOString()
  const minutes = Math.min(60, Math.max(5, Number(useRuntimeConfig(event).authMagicLinkMinutes) || 15))
  const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString()
  const tokenId = `auth-${randomToken()}`
  await db.prepare("INSERT INTO auth_tokens (id, email, email_normalized, purpose, token_hash, redirect_path, expires_at, created_at) VALUES (?, ?, ?, 'magic_link', ?, ?, ?, ?)").bind(tokenId, email, email, await tokenHash(token), redirectPath, expiresAt, now).run()
  try {
    const delivery = await deliverMagicLink(event, email, token, redirectPath)
    setHeader(event, 'Cache-Control', 'no-store')
    return { ok: true, message: 'If that address can receive mail, a sign-in link is on its way.', ...delivery }
  } catch (error: any) {
    await db.prepare('DELETE FROM auth_tokens WHERE id = ?').bind(tokenId).run()
    if (error?.data?.code === 'email_unavailable') {
      throw createError({ statusCode: 503, statusMessage: 'Email delivery is not configured. Add NUXT_RESEND_API_KEY and NUXT_AUTH_EMAIL_FROM in Cloudflare Pages settings.', data: { code: 'email_unavailable' } })
    }
    throw error
  }
})
