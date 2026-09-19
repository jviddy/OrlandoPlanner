import { assertSameOrigin, clearSessionCookie, currentSession, requireAuthDb } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const db = requireAuthDb(event)
  const session = await currentSession(event, db)
  if (session) await db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').bind(new Date().toISOString(), session.sessionId).run()
  clearSessionCookie(event)
  setResponseStatus(event, 204)
  return null
})
