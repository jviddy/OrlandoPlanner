import { assertSameOrigin, createSession, purgeExpiredAuthData, requireAuthDb } from '../../utils/auth'
import { randomToken, tokenHash } from '../../utils/anonymousTrips'

interface MagicTokenRow { id: string; email: string; email_normalized: string; redirect_path: string }
interface UserRow { id: string; email: string; display_name: string; global_role: 'user' | 'agent' | 'admin' }

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const db = requireAuthDb(event)
  const body = await readBody(event)
  const token = typeof body?.token === 'string' ? body.token : ''
  if (token.length < 32) throw createError({ statusCode: 400, statusMessage: 'Sign-in link is invalid or expired', data: { code: 'invalid_magic_link' } })
  const hash = await tokenHash(token)
  const now = new Date().toISOString()
  const magic = await db.prepare("SELECT id, email, email_normalized, redirect_path FROM auth_tokens WHERE token_hash = ? AND purpose = 'magic_link' AND used_at IS NULL AND expires_at > ?").bind(hash, now).first<MagicTokenRow>()
  if (!magic) throw createError({ statusCode: 400, statusMessage: 'Sign-in link is invalid or expired', data: { code: 'invalid_magic_link' } })

  const proposedUserId = `user-${randomToken()}`
  await db.prepare('INSERT INTO users (id, email, email_normalized, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email_normalized) DO NOTHING').bind(proposedUserId, magic.email, magic.email_normalized, now, now, now).run()
  const user = await db.prepare('SELECT id, email, display_name, global_role FROM users WHERE email_normalized = ? AND deleted_at IS NULL').bind(magic.email_normalized).first<UserRow>()
  if (!user) throw createError({ statusCode: 403, statusMessage: 'Account unavailable', data: { code: 'account_unavailable' } })

  const used = await db.prepare('UPDATE auth_tokens SET used_at = ?, used_by_user_id = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?').bind(now, user.id, magic.id, now).run()
  if (!used.meta?.changes) throw createError({ statusCode: 400, statusMessage: 'Sign-in link is invalid or expired', data: { code: 'invalid_magic_link' } })
  await createSession(event, db, user.id)
  await purgeExpiredAuthData(db)
  setHeader(event, 'Cache-Control', 'no-store')
  return { user: { id: user.id, email: user.email, displayName: user.display_name, globalRole: user.global_role }, redirectPath: magic.redirect_path }
})
