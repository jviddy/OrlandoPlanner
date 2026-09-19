import { assertSameOrigin, requireAuthDb, requireSession } from '../../../utils/auth'
import { randomToken, validateTripPayload } from '../../../utils/anonymousTrips'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const db = requireAuthDb(event)
  const { user } = await requireSession(event, db)
  const sourceId = getRouterParam(event, 'id') ?? ''

  // Source must be an owned trip the user can view, with duplication allowed.
  const source = await db.prepare('SELECT t.id, t.status, t.payload_json, t.allow_duplication, m.role FROM trips t JOIN trip_memberships m ON m.trip_id = t.id WHERE t.id = ? AND m.user_id = ? AND m.revoked_at IS NULL AND t.deleted_at IS NULL').bind(sourceId, user.id).first<{ id: string; status: string; payload_json: string; allow_duplication: number; role: string }>()
  if (!source) throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
  if (source.status !== 'owned') throw createError({ statusCode: 400, statusMessage: 'Can only duplicate owned trips', data: { code: 'invalid_trip_status' } })
  if (!source.allow_duplication) throw createError({ statusCode: 403, statusMessage: 'Duplication is not allowed for this trip', data: { code: 'duplication_disabled' } })

  // Build the new payload with a fresh trip ID.
  const originalPayload = JSON.parse(source.payload_json) as Record<string, unknown>
  const newTripId = `trip-${randomToken()}`
  const newPayload = { ...originalPayload, tripId: newTripId }

  // Validate the duplicated payload (catches corruption).
  const validated = validateTripPayload(newPayload)

  const now = new Date().toISOString()
  const membershipId = `membership-${randomToken()}`
  const results = await db.batch([
    db.prepare("INSERT INTO trips (id, status, visibility, payload_schema_version, payload_json, revision, allow_anonymous_edit, allow_duplication, duplicated_from_trip_id, created_at, updated_at) VALUES (?, 'owned', 'private', ?, ?, 1, 0, 1, ?, ?, ?)").bind(newTripId, validated.version, JSON.stringify(validated), sourceId, now, now),
    db.prepare('INSERT INTO trip_memberships (id, trip_id, user_id, role, created_at) VALUES (?, ?, ?, \'owner\', ?)').bind(membershipId, newTripId, user.id, now),
    db.prepare("INSERT INTO activity_log (trip_id, to_revision, actor_user_id, actor_display_name, action, summary, created_at) VALUES (?, 1, ?, ?, 'duplicate', ?, ?)").bind(newTripId, user.id, user.displayName, `Duplicated from ${sourceId}`, now),
  ])
  if (!results[0]?.meta?.changes) throw createError({ statusCode: 500, statusMessage: 'Could not create duplicate', data: { code: 'duplicate_failed' } })

  setResponseStatus(event, 201)
  return { tripId: newTripId, revision: 1, sourceTripId: sourceId }
})
