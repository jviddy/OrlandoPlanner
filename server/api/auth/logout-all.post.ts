import { assertSameOrigin, clearSessionCookie, requireAuthDb, requireSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const db = requireAuthDb(event)
  const { user } = await requireSession(event, db)
  await db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').bind(new Date().toISOString(), user.id).run()
  clearSessionCookie(event)
  setResponseStatus(event, 204)
  return null
})
