import { anonymousExpiry, bearer, enforceRateLimit, requireAnonymousDb, tokenHash, validateTripPayload } from '../../utils/anonymousTrips'

interface EditableTrip { revision: number; capability_id: string }

export default defineEventHandler(async (event) => {
  const db = requireAnonymousDb(event)
  await enforceRateLimit(event, db, 120, 'anonymous-write')
  const id = getRouterParam(event, 'id') ?? ''
  const expected = Number(getHeader(event, 'if-match'))
  if (!Number.isInteger(expected) || expected < 1) throw createError({ statusCode: 428, statusMessage: 'If-Match revision required', data: { code: 'revision_required' } })
  const body = validateTripPayload(await readBody(event))
  if (body.tripId !== id) throw createError({ statusCode: 400, statusMessage: 'Trip ID does not match route', data: { code: 'trip_id_mismatch' } })
  const hash = await tokenHash(bearer(event))
  const now = new Date().toISOString()
  const editable = await db.prepare("SELECT t.revision, c.id AS capability_id FROM trips t JOIN trip_capabilities c ON c.trip_id = t.id WHERE t.id = ? AND t.status = 'anonymous' AND t.deleted_at IS NULL AND t.expires_at > ? AND c.kind = 'edit' AND c.token_hash = ? AND c.revoked_at IS NULL AND c.expires_at > ?").bind(id, now, hash, now).first<EditableTrip>()
  if (!editable) throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
  if (editable.revision !== expected) throw createError({ statusCode: 409, statusMessage: 'Trip changed', data: { code: 'revision_conflict', currentRevision: editable.revision } })

  const expiresAt = anonymousExpiry()
  const results = await db.batch([
    db.prepare("UPDATE trips SET payload_json = ?, payload_schema_version = ?, revision = revision + 1, updated_at = ?, expires_at = ? WHERE id = ? AND status = 'anonymous' AND revision = ? AND deleted_at IS NULL AND expires_at > ?").bind(JSON.stringify(body), body.version, now, expiresAt, id, expected, now),
    db.prepare('UPDATE trip_capabilities SET expires_at = ?, last_used_at = CASE WHEN id = ? THEN ? ELSE last_used_at END WHERE trip_id = ? AND revoked_at IS NULL').bind(expiresAt, editable.capability_id, now, id),
    db.prepare("UPDATE idempotency_records SET response_revision = ? WHERE scope = 'anonymous-trip-create' AND resource_id = ?").bind(expected + 1, id),
    db.prepare("INSERT INTO activity_log (trip_id, from_revision, to_revision, actor_capability_id, action, summary, created_at) SELECT id, ?, revision, ?, 'update', 'Anonymous trip updated', ? FROM trips WHERE id = ? AND revision = ?").bind(expected, editable.capability_id, now, id, expected + 1),
  ])
  if (!results[0]?.meta?.changes) throw createError({ statusCode: 409, statusMessage: 'Trip changed', data: { code: 'revision_conflict' } })
  setHeader(event, 'ETag', String(expected + 1))
  setHeader(event, 'X-Trip-Expires-At', expiresAt)
  return { revision: expected + 1, expiresAt }
})
