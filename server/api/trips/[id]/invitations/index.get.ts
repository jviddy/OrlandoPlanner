import { requireAuthDb, requireSession } from '../../../../utils/auth'

interface InvitationRow {
  id: string
  email: string
  role: 'editor' | 'viewer'
  expires_at: string
  created_at: string
  accepted_at: string | null
  revoked_at: string | null
}

export default defineEventHandler(async (event) => {
  const db = requireAuthDb(event)
  const { user } = await requireSession(event, db)
  const tripId = getRouterParam(event, 'id') ?? ''

  const row = await db.prepare('SELECT t.id, t.status, m.role FROM trips t JOIN trip_memberships m ON m.trip_id = t.id WHERE t.id = ? AND m.user_id = ? AND m.revoked_at IS NULL AND t.deleted_at IS NULL').bind(tripId, user.id).first<{ id: string; status: string; role: string }>()
  if (!row || (row.role !== 'owner' && row.role !== 'agent')) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
  }

  const result = await db.prepare('SELECT id, email, role, expires_at, created_at, accepted_at, revoked_at FROM invitations WHERE trip_id = ? ORDER BY created_at DESC').bind(tripId).all<InvitationRow>()
  const invitations = (result.results ?? []).filter((i) => !i.revoked_at && (i.accepted_at || new Date(i.expires_at) > new Date()))

  setHeader(event, 'Cache-Control', 'no-store')
  return { invitations: invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expires_at, createdAt: i.created_at, acceptedAt: i.accepted_at })) }
})
