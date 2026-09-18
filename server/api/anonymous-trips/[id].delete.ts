import { bearer, enforceRateLimit, requireAnonymousDb, tokenHash } from '../../utils/anonymousTrips'

export default defineEventHandler(async (event) => {
  const db = requireAnonymousDb(event)
  await enforceRateLimit(event, db, 60)
  const id = getRouterParam(event, 'id') ?? ''
  const hash = await tokenHash(bearer(event))
  const now = new Date().toISOString()
  const result = await db.prepare('UPDATE anonymous_trips SET deleted_at = ?, updated_at = ?, revision = revision + 1 WHERE id = ? AND edit_token_hash = ? AND deleted_at IS NULL').bind(now, now, id, hash).run()
  if (!result.meta?.changes) throw createError({ statusCode: 404, statusMessage: 'Trip not found' })
  await db.prepare('INSERT INTO anonymous_trip_activity (trip_id, revision, action, created_at) SELECT id, revision, ?, ? FROM anonymous_trips WHERE id = ?').bind('revoke', now, id).run()
  setResponseStatus(event, 204)
  return null
})
