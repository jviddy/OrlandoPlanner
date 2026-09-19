import { assertSameOrigin, requireAuthDb, requireSession } from '../../utils/auth'
import { randomToken, tokenHash } from '../../utils/anonymousTrips'

interface InvitationRow {
  id: string
  trip_id: string
  role: 'editor' | 'viewer'
}

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const db = requireAuthDb(event)
  const { user } = await requireSession(event, db)
  const token = getRouterParam(event, 'token') ?? ''
  if (token.length < 32) throw createError({ statusCode: 400, statusMessage: 'Invitation link is invalid', data: { code: 'invalid_invitation' } })

  const hash = await tokenHash(token)
  const now = new Date().toISOString()
  const invitation = await db.prepare("SELECT i.id, i.trip_id, i.role FROM invitations i JOIN trips t ON t.id = i.trip_id WHERE i.token_hash = ? AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > ? AND t.deleted_at IS NULL AND t.status = 'owned'").bind(hash, now).first<InvitationRow>()
  if (!invitation) throw createError({ statusCode: 400, statusMessage: 'Invitation is invalid or expired', data: { code: 'invalid_invitation' } })

  // Prevent accepting your own invitation.
  const invitedEmail = await db.prepare('SELECT email FROM invitations WHERE id = ?').bind(invitation.id).first<{ email: string }>()
  if (invitedEmail?.email === user.email) throw createError({ statusCode: 400, statusMessage: 'You cannot accept your own invitation', data: { code: 'self_accept' } })

  // Check if the user already has an active membership for this trip.
  const existing = await db.prepare('SELECT id FROM trip_memberships WHERE trip_id = ? AND user_id = ? AND revoked_at IS NULL').bind(invitation.trip_id, user.id).first<{ id: string }>()
  if (existing) throw createError({ statusCode: 409, statusMessage: 'You already have access to this trip', data: { code: 'already_member' } })

  const membershipId = `membership-${randomToken()}`
  const results = await db.batch([
    db.prepare('UPDATE invitations SET accepted_by_user_id = ?, accepted_at = ? WHERE id = ? AND accepted_at IS NULL AND revoked_at IS NULL').bind(user.id, now, invitation.id),
    db.prepare('INSERT INTO trip_memberships (id, trip_id, user_id, role, invited_by_user_id, created_at) SELECT ?, ?, ?, i.role, i.invited_by_user_id, ? FROM invitations i WHERE i.id = ? AND i.accepted_at IS NULL AND i.revoked_at IS NULL').bind(membershipId, invitation.trip_id, user.id, now, invitation.id),
    db.prepare("INSERT INTO activity_log (trip_id, actor_user_id, actor_display_name, action, summary, created_at) VALUES (?, ?, ?, 'invite_accepted', ?, ?)").bind(invitation.trip_id, user.id, user.displayName, `Invitation accepted as ${invitation.role}`, now),
  ])
  if (!results[0]?.meta?.changes || !results[1]?.meta?.changes) {
    throw createError({ statusCode: 409, statusMessage: 'Invitation could not be accepted', data: { code: 'invitation_conflict' } })
  }

  return { tripId: invitation.trip_id, role: invitation.role }
})
