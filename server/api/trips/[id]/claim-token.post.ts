import { bearer, randomToken, requireAnonymousDb, tokenHash } from '../../../utils/anonymousTrips'

export default defineEventHandler(async (event) => {
  const db = requireAnonymousDb(event)
  const tripId = getRouterParam(event, 'id') ?? ''
  const hash = await tokenHash(bearer(event))
  const now = new Date().toISOString()
  const capability = await db.prepare("SELECT c.id FROM trip_capabilities c JOIN trips t ON t.id = c.trip_id WHERE t.id = ? AND t.status = 'anonymous' AND t.deleted_at IS NULL AND c.kind = 'edit' AND c.token_hash = ? AND c.revoked_at IS NULL AND c.expires_at > ?").bind(tripId, hash, now).first<{ id: string }>()
  if (!capability) throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
  const token = randomToken()
  const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString()
  await db.batch([
    db.prepare('UPDATE claim_tokens SET revoked_at = ? WHERE trip_id = ? AND used_at IS NULL AND revoked_at IS NULL').bind(now, tripId),
    db.prepare('INSERT INTO claim_tokens (id, trip_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').bind(`claim-${randomToken()}`, tripId, await tokenHash(token), expiresAt, now),
  ])
  return { claimToken: token, expiresAt }
})
