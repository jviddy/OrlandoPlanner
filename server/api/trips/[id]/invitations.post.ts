import { assertSameOrigin, deliverTripInvitation, normalizeEmail, requireAuthDb, requireSession } from '../../../utils/auth'
import { randomToken, tokenHash } from '../../../utils/anonymousTrips'

const INVITATION_EXPIRY_DAYS = 7

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const db = requireAuthDb(event)
  const { user } = await requireSession(event, db)
  const tripId = getRouterParam(event, 'id') ?? ''
  const body = await readBody(event)
  const email = normalizeEmail(body?.email)
  const role = body?.role
  if (role !== 'editor' && role !== 'viewer') throw createError({ statusCode: 400, statusMessage: 'role must be "editor" or "viewer"', data: { code: 'invalid_role' } })

  // Only owner and agent can manage sharing.
  const trip = await db.prepare('SELECT t.id, t.status, t.payload_json, m.role AS member_role FROM trips t JOIN trip_memberships m ON m.trip_id = t.id WHERE t.id = ? AND m.user_id = ? AND m.revoked_at IS NULL AND t.deleted_at IS NULL').bind(tripId, user.id).first<{ id: string; status: string; payload_json: string; member_role: string }>()
  if (!trip || (trip.member_role !== 'owner' && trip.member_role !== 'agent')) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
  }
  if (trip.status !== 'owned') throw createError({ statusCode: 400, statusMessage: 'Invitations are only available for owned trips', data: { code: 'invalid_trip_status' } })

  // Prevent inviting yourself.
  if (email === user.email) throw createError({ statusCode: 400, statusMessage: 'You cannot invite yourself', data: { code: 'self_invite' } })

  // Revoke any existing active invitation for this email+trip+role.
  const now = new Date().toISOString()
  await db.prepare('UPDATE invitations SET revoked_at = ? WHERE trip_id = ? AND email = ? AND role = ? AND accepted_at IS NULL AND revoked_at IS NULL').bind(now, tripId, email, role).run()

  const token = randomToken()
  const inviteId = `invite-${randomToken()}`
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 86_400_000).toISOString()

  await db.prepare('INSERT INTO invitations (id, trip_id, email, role, token_hash, invited_by_user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(inviteId, tripId, email, role, await tokenHash(token), user.id, expiresAt, now).run()

  let delivery: { devLink?: string }
  try {
    const payload = JSON.parse(trip.payload_json) as { name?: string }
    delivery = await deliverTripInvitation(event, email, token, {
      tripName: payload.name?.trim() || 'an Orlando trip',
      inviterName: user.displayName || user.email,
      role,
    })
  } catch (error) {
    await db.prepare('UPDATE invitations SET revoked_at = ? WHERE id = ?').bind(new Date().toISOString(), inviteId).run()
    throw error
  }

  setResponseStatus(event, 201)
  return { invitationId: inviteId, email, role, expiresAt, ...delivery }
})
