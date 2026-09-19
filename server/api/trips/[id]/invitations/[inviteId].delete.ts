import { assertSameOrigin, requireAuthDb, requireSession } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const db = requireAuthDb(event)
  const { user } = await requireSession(event, db)
  const tripId = getRouterParam(event, 'id') ?? ''
  const inviteId = getRouterParam(event, 'inviteId') ?? ''

  const row = await db.prepare('SELECT t.id, t.status, m.role FROM trips t JOIN trip_memberships m ON m.trip_id = t.id WHERE t.id = ? AND m.user_id = ? AND m.revoked_at IS NULL AND t.deleted_at IS NULL').bind(tripId, user.id).first<{ id: string; status: string; role: string }>()
  if (!row || (row.role !== 'owner' && row.role !== 'agent')) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
  }

  const now = new Date().toISOString()
  const result = await db.prepare('UPDATE invitations SET revoked_at = ? WHERE id = ? AND trip_id = ? AND revoked_at IS NULL').bind(now, inviteId, tripId).run()
  if (!result.meta?.changes) throw createError({ statusCode: 404, statusMessage: 'Invitation not found', data: { code: 'invitation_not_found' } })

  setResponseStatus(event, 204)
  return null
})
