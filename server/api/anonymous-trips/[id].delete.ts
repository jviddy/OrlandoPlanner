import { bearer, enforceRateLimit, requireAnonymousDb, tokenHash } from '../../utils/anonymousTrips'

interface RevocableTrip { revision: number; capability_id: string }

export default defineEventHandler(async (event) => {
  const db = requireAnonymousDb(event)
  await enforceRateLimit(event, db, 60, 'anonymous-revoke')
  const id = getRouterParam(event, 'id') ?? ''
  const hash = await tokenHash(bearer(event))
  const now = new Date().toISOString()
  const row = await db.prepare("SELECT t.revision, c.id AS capability_id FROM trips t JOIN trip_capabilities c ON c.trip_id = t.id WHERE t.id = ? AND t.status = 'anonymous' AND t.deleted_at IS NULL AND c.kind = 'edit' AND c.token_hash = ? AND c.revoked_at IS NULL").bind(id, hash).first<RevocableTrip>()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
  const results = await db.batch([
    db.prepare("UPDATE trips SET deleted_at = ?, updated_at = ?, revision = revision + 1 WHERE id = ? AND status = 'anonymous' AND deleted_at IS NULL").bind(now, now, id),
    db.prepare('UPDATE trip_capabilities SET revoked_at = ? WHERE trip_id = ? AND revoked_at IS NULL').bind(now, id),
    db.prepare("INSERT INTO activity_log (trip_id, from_revision, to_revision, actor_capability_id, action, summary, created_at) SELECT id, ?, revision, ?, 'revoke', 'Anonymous server copy revoked', ? FROM trips WHERE id = ? AND revision = ?").bind(row.revision, row.capability_id, now, id, row.revision + 1),
  ])
  if (!results[0]?.meta?.changes) throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
  setResponseStatus(event, 204)
  return null
})
