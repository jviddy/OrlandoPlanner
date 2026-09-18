import { capabilityToken, enforceRateLimit, requireAnonymousDb, tokenHash, validateTripPayload } from '../../utils/anonymousTrips'

export default defineEventHandler(async (event) => {
  const db = requireAnonymousDb(event)
  await enforceRateLimit(event, db, 20)
  const body = await readBody(event)
  validateTripPayload(body)
  const idempotency = getHeader(event, 'idempotency-key')?.slice(0, 128)
  if (!idempotency) throw createError({ statusCode: 400, statusMessage: 'Idempotency-Key required' })
  const secret = String(useRuntimeConfig(event).anonymousCapabilitySecret)
  const idempotencyHash = await tokenHash(idempotency)
  const editToken = await capabilityToken(secret, `${idempotency}:edit`)
  const viewToken = await capabilityToken(secret, `${idempotency}:view`)
  const existing = await db.prepare('SELECT c.trip_id, t.revision FROM anonymous_trip_creations c JOIN anonymous_trips t ON t.id = c.trip_id WHERE c.idempotency_hash = ? AND t.deleted_at IS NULL').bind(idempotencyHash).first<any>()
  if (existing) return { tripId: existing.trip_id, editToken, viewToken, revision: existing.revision }
  const tripId = String(body.tripId)
  const editHash = await tokenHash(editToken); const viewHash = await tokenHash(viewToken)
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 180 * 86_400_000).toISOString()
  await db.prepare('INSERT INTO anonymous_trips (id, edit_token_hash, view_token_hash, revision, payload, created_at, updated_at, expires_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?)').bind(tripId, editHash, viewHash, JSON.stringify({ ...body, tripId }), now, now, expiresAt).run()
  await db.prepare('INSERT INTO anonymous_trip_creations (idempotency_hash, trip_id, revision, created_at) VALUES (?, ?, 1, ?)').bind(idempotencyHash, tripId, now).run()
  await db.prepare('INSERT INTO anonymous_trip_activity (trip_id, revision, action, created_at) VALUES (?, 1, ?, ?)').bind(tripId, 'create', now).run()
  return { tripId, editToken, viewToken, revision: 1 }
})
