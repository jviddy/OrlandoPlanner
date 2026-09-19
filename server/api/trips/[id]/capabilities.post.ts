import { assertSameOrigin, requireAuthDb, requireSession } from '../../../utils/auth'
import { randomToken, tokenHash } from '../../../utils/anonymousTrips'

const MAX_CAPABILITIES_PER_TRIP = 20
const DEFAULT_EXPIRY_DAYS = 30

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const db = requireAuthDb(event)
  const { user } = await requireSession(event, db)
  const tripId = getRouterParam(event, 'id') ?? ''
  const body = await readBody(event)
  const kind = body?.kind
  if (kind !== 'view' && kind !== 'edit') throw createError({ statusCode: 400, statusMessage: 'kind must be "view" or "edit"', data: { code: 'invalid_kind' } })

  // Only owner and agent can manage sharing.
  const row = await db.prepare('SELECT t.id, t.status, m.role FROM trips t JOIN trip_memberships m ON m.trip_id = t.id WHERE t.id = ? AND m.user_id = ? AND m.revoked_at IS NULL AND t.deleted_at IS NULL').bind(tripId, user.id).first<{ id: string; status: string; role: string }>()
  if (!row || (row.role !== 'owner' && row.role !== 'agent')) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
  }

  // Capabilities only make sense on owned trips (anonymous trips use the anonymous capability flow).
  if (row.status !== 'owned') throw createError({ statusCode: 400, statusMessage: 'Capabilities are only available for owned trips', data: { code: 'invalid_trip_status' } })

  // Enforce a reasonable cap to prevent unbounded growth.
  const existing = await db.prepare('SELECT COUNT(*) AS count FROM trip_capabilities WHERE trip_id = ? AND revoked_at IS NULL').bind(tripId).first<{ count: number }>()
  if ((existing?.count ?? 0) >= MAX_CAPABILITIES_PER_TRIP) {
    throw createError({ statusCode: 429, statusMessage: 'Too many active capabilities', data: { code: 'capability_limit_reached' } })
  }

  const token = randomToken()
  const capId = `cap-${randomToken()}`
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 86_400_000).toISOString()

  await db.prepare('INSERT INTO trip_capabilities (id, trip_id, kind, token_hash, created_by_user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(capId, tripId, kind, await tokenHash(token), user.id, expiresAt, now).run()

  setResponseStatus(event, 201)
  return { capabilityId: capId, kind, token, expiresAt }
})
