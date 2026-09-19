import { bearer, enforceRateLimit, requireAnonymousDb, tokenHash } from '../../utils/anonymousTrips'
import { redactTripPayload } from '../../utils/tripRedaction'

interface ReadableTrip {
  payload_json: string
  revision: number
  expires_at: string
  capability_id: string
  kind: string
}

export default defineEventHandler(async (event) => {
  const db = requireAnonymousDb(event)
  await enforceRateLimit(event, db, 120, 'anonymous-read')
  const id = getRouterParam(event, 'id') ?? ''
  const hash = await tokenHash(bearer(event))
  const now = new Date().toISOString()
  const row = await db.prepare("SELECT t.payload_json, t.revision, t.expires_at, c.id AS capability_id, c.kind FROM trips t JOIN trip_capabilities c ON c.trip_id = t.id WHERE t.id = ? AND t.status = 'anonymous' AND t.deleted_at IS NULL AND t.expires_at > ? AND c.token_hash = ? AND c.revoked_at IS NULL AND c.expires_at > ?").bind(id, now, hash, now).first<ReadableTrip>()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
  await db.prepare('UPDATE trip_capabilities SET last_used_at = ? WHERE id = ?').bind(now, row.capability_id).run()
  const target = row.kind === 'edit' ? 'capability-edit' : 'capability-view'
  setHeader(event, 'ETag', String(row.revision))
  setHeader(event, 'X-Trip-Expires-At', row.expires_at)
  return redactTripPayload(JSON.parse(row.payload_json), target)
})
