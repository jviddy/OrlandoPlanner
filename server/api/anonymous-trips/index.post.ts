import { capabilityToken, requireAnonymousDb, tokenHash, validateTripPayload } from '../../utils/anonymousTrips'

export default defineEventHandler(async (event) => {
  const db = requireAnonymousDb(event)
  const body = await readBody(event)
  validateTripPayload(body)
  const idempotency = getHeader(event, 'idempotency-key')?.slice(0, 128)
  if (!idempotency) throw createError({ statusCode: 400, statusMessage: 'Idempotency-Key required' })
  const secret = String(useRuntimeConfig(event).anonymousCapabilitySecret)
  const idempotencyHash = await tokenHash(idempotency)
  const editToken = await capabilityToken(secret, `${idempotency}:edit`)
  const viewToken = await capabilityToken(secret, `${idempotency}:view`)
  const existing = await db.prepare('SELECT trip_id, revision FROM anonymous_trip_creations WHERE idempotency_hash = ?').bind(idempotencyHash).first<any>()
  if (existing) return { tripId: existing.trip_id, editToken, viewToken, revision: existing.revision }
  const tripId = crypto.randomUUID()
  const editHash = await tokenHash(editToken); const viewHash = await tokenHash(viewToken)
  const now = new Date().toISOString()
  await db.prepare('INSERT INTO anonymous_trips (id, edit_token_hash, view_token_hash, revision, payload, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)').bind(tripId, editHash, viewHash, JSON.stringify({ ...body, tripId }), now, now).run()
  await db.prepare('INSERT INTO anonymous_trip_creations (idempotency_hash, trip_id, revision, created_at) VALUES (?, ?, 1, ?)').bind(idempotencyHash, tripId, now).run()
  return { tripId, editToken, viewToken, revision: 1 }
})
