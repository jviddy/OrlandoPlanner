import { assertSameOrigin, requireAuthDb, requireSession } from '../../utils/auth'
import { randomToken, tokenHash, validateTripPayload } from '../../utils/anonymousTrips'

interface ExistingIdempotency { resource_id: string; response_revision: number }

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const db = requireAuthDb(event)
  const { user } = await requireSession(event, db)
  const body = validateTripPayload(await readBody(event))
  const idempotency = getHeader(event, 'idempotency-key')?.slice(0, 128) ?? ''
  if (idempotency.length < 16) throw createError({ statusCode: 400, statusMessage: 'Idempotency-Key required', data: { code: 'idempotency_key_required' } })
  const scope = `owned-trip-create:${user.id}`
  const keyHash = await tokenHash(idempotency)
  const now = new Date().toISOString()
  const existing = await db.prepare('SELECT resource_id, response_revision FROM idempotency_records WHERE scope = ? AND key_hash = ? AND expires_at > ?').bind(scope, keyHash, now).first<ExistingIdempotency>()
  if (existing) return { tripId: existing.resource_id, revision: existing.response_revision }

  const collision = await db.prepare('SELECT status FROM trips WHERE id = ?').bind(body.tripId).first<{ status: string }>()
  if (collision) throw createError({ statusCode: 409, statusMessage: collision.status === 'anonymous' ? 'Claim this anonymous trip instead' : 'Trip ID already exists', data: { code: collision.status === 'anonymous' ? 'trip_requires_claim' : 'trip_id_conflict' } })
  const membershipId = `membership-${randomToken()}`
  const replayExpiresAt = new Date(Date.now() + 86_400_000).toISOString()
  await db.batch([
    db.prepare("INSERT INTO trips (id, status, visibility, payload_schema_version, payload_json, revision, allow_anonymous_edit, allow_duplication, created_at, updated_at) VALUES (?, 'owned', 'private', ?, ?, 1, 0, 1, ?, ?)").bind(body.tripId, body.version, JSON.stringify(body), now, now),
    db.prepare("INSERT INTO trip_memberships (id, trip_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)").bind(membershipId, body.tripId, user.id, now),
    db.prepare('INSERT INTO idempotency_records (scope, key_hash, resource_id, capability_key_version, response_revision, expires_at, created_at) VALUES (?, ?, ?, 0, 1, ?, ?)').bind(scope, keyHash, body.tripId, replayExpiresAt, now),
    db.prepare("INSERT INTO activity_log (trip_id, to_revision, actor_user_id, actor_display_name, action, summary, created_at) VALUES (?, 1, ?, ?, 'create_owned', 'Owned trip created', ?)").bind(body.tripId, user.id, user.displayName, now),
  ])
  setResponseStatus(event, 201)
  return { tripId: body.tripId, revision: 1 }
})
