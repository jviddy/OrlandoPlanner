import {
  anonymousExpiry,
  capabilityKey,
  capabilityToken,
  enforceRateLimit,
  purgeExpiredAnonymousData,
  randomToken,
  rejectSensitiveFields,
  requireAnonymousDb,
  tokenHash,
  validateTripPayload,
} from '../../utils/anonymousTrips'

interface ExistingCreation {
  resource_id: string
  response_revision: number
  capability_key_version: number
  expires_at: string
}

export default defineEventHandler(async (event) => {
  const db = requireAnonymousDb(event)
  await enforceRateLimit(event, db, 20, 'anonymous-create')
  await purgeExpiredAnonymousData(db)
  const body = validateTripPayload(await readBody(event))
  rejectSensitiveFields(body)
  const idempotency = getHeader(event, 'idempotency-key')?.slice(0, 128) ?? ''
  if (idempotency.length < 16) throw createError({ statusCode: 400, statusMessage: 'Idempotency-Key required', data: { code: 'idempotency_key_required' } })

  const idempotencyHash = await tokenHash(idempotency)
  const existing = await db.prepare("SELECT i.resource_id, i.response_revision, i.capability_key_version, t.expires_at FROM idempotency_records i JOIN trips t ON t.id = i.resource_id WHERE i.scope = 'anonymous-trip-create' AND i.key_hash = ? AND i.expires_at > ? AND t.deleted_at IS NULL").bind(idempotencyHash, new Date().toISOString()).first<ExistingCreation>()
  if (existing) {
    const key = capabilityKey(event, existing.capability_key_version)
    return {
      tripId: existing.resource_id,
      editToken: await capabilityToken(key.secret, `${idempotency}:edit`),
      viewToken: await capabilityToken(key.secret, `${idempotency}:view`),
      revision: existing.response_revision,
      expiresAt: existing.expires_at,
    }
  }

  const collision = await db.prepare('SELECT id FROM trips WHERE id = ?').bind(body.tripId).first<{ id: string }>()
  if (collision) throw createError({ statusCode: 409, statusMessage: 'Trip ID already exists', data: { code: 'trip_id_conflict' } })

  const key = capabilityKey(event)
  const editToken = await capabilityToken(key.secret, `${idempotency}:edit`)
  const viewToken = await capabilityToken(key.secret, `${idempotency}:view`)
  const editHash = await tokenHash(editToken)
  const viewHash = await tokenHash(viewToken)
  const editCapabilityId = `cap-${randomToken()}`
  const viewCapabilityId = `cap-${randomToken()}`
  const now = new Date().toISOString()
  const expiresAt = anonymousExpiry()
  const replayExpiresAt = new Date(Date.now() + 86_400_000).toISOString()

  await db.batch([
    db.prepare("INSERT INTO trips (id, status, visibility, payload_schema_version, payload_json, revision, allow_anonymous_edit, allow_duplication, expires_at, created_at, updated_at) VALUES (?, 'anonymous', 'unlisted', ?, ?, 1, 1, 1, ?, ?, ?)").bind(body.tripId, body.version, JSON.stringify(body), expiresAt, now, now),
    db.prepare("INSERT INTO trip_capabilities (id, trip_id, kind, token_hash, key_version, expires_at, created_at) VALUES (?, ?, 'edit', ?, ?, ?, ?)").bind(editCapabilityId, body.tripId, editHash, key.version, expiresAt, now),
    db.prepare("INSERT INTO trip_capabilities (id, trip_id, kind, token_hash, key_version, expires_at, created_at) VALUES (?, ?, 'view', ?, ?, ?, ?)").bind(viewCapabilityId, body.tripId, viewHash, key.version, expiresAt, now),
    db.prepare("INSERT INTO idempotency_records (scope, key_hash, resource_id, capability_key_version, response_revision, expires_at, created_at) VALUES ('anonymous-trip-create', ?, ?, ?, 1, ?, ?)").bind(idempotencyHash, body.tripId, key.version, replayExpiresAt, now),
    db.prepare("INSERT INTO activity_log (trip_id, to_revision, actor_capability_id, action, summary, created_at) VALUES (?, 1, ?, 'create', 'Anonymous server copy created', ?)").bind(body.tripId, editCapabilityId, now),
  ])
  setResponseStatus(event, 201)
  return { tripId: body.tripId, editToken, viewToken, revision: 1, expiresAt }
})
