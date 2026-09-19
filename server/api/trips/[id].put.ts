import { assertSameOrigin, requireAuthDb } from '../../utils/auth'
import { validateTripPayload } from '../../utils/anonymousTrips'
import { persistedDetailsSignature, requireAccessibleTrip } from '../../utils/tripAccess'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const db = requireAuthDb(event)
  const tripId = getRouterParam(event, 'id') ?? ''
  const current = await requireAccessibleTrip(event, db, tripId, 'plan:edit')
  const expected = Number(getHeader(event, 'if-match'))
  if (!Number.isInteger(expected) || expected < 1) throw createError({ statusCode: 428, statusMessage: 'If-Match revision required', data: { code: 'revision_required' } })
  if (current.revision !== expected) throw createError({ statusCode: 409, statusMessage: 'Trip changed', data: { code: 'revision_conflict', currentRevision: current.revision } })
  const body = validateTripPayload(await readBody(event))
  if (body.tripId !== tripId) throw createError({ statusCode: 400, statusMessage: 'Trip ID does not match route', data: { code: 'trip_id_mismatch' } })
  if (current.accessKind === 'capability' || (current.role === 'editor' && persistedDetailsSignature(JSON.parse(current.payload_json)) !== persistedDetailsSignature(body))) {
    if (persistedDetailsSignature(JSON.parse(current.payload_json)) !== persistedDetailsSignature(body)) {
      throw createError({ statusCode: 403, statusMessage: 'Editors cannot change trip details', data: { code: 'details_permission_required' } })
    }
  }
  const now = new Date().toISOString()
  const actorUserId = current.accessKind === 'member' ? current.actorUserId ?? null : null
  const actorDisplayName = current.accessKind === 'member' ? current.actorDisplayName ?? 'Member' : 'Shared link editor'
  const results = await db.batch([
    db.prepare("UPDATE trips SET payload_json = ?, payload_schema_version = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND status = 'owned' AND revision = ? AND deleted_at IS NULL").bind(JSON.stringify(body), body.version, now, tripId, expected),
    db.prepare("INSERT INTO activity_log (trip_id, from_revision, to_revision, actor_user_id, actor_capability_id, actor_display_name, action, summary, created_at) SELECT id, ?, revision, ?, ?, ?, 'update', 'Trip updated', ? FROM trips WHERE id = ? AND revision = ?").bind(expected, actorUserId, current.capabilityId ?? null, actorDisplayName, now, tripId, expected + 1),
  ])
  if (!results[0]?.meta?.changes) throw createError({ statusCode: 409, statusMessage: 'Trip changed', data: { code: 'revision_conflict' } })
  setHeader(event, 'ETag', String(expected + 1))
  return { revision: expected + 1 }
})
