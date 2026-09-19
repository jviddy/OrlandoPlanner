import { requireAuthDb, requireSession } from '../../../../utils/auth'

interface MemberRow {
  id: string
  user_id: string
  email: string
  display_name: string
  role: 'owner' | 'agent' | 'editor' | 'viewer'
  created_at: string
}

export default defineEventHandler(async (event) => {
  const db = requireAuthDb(event)
  const { user } = await requireSession(event, db)
  const tripId = getRouterParam(event, 'id') ?? ''
  const manager = await db.prepare('SELECT role FROM trip_memberships WHERE trip_id = ? AND user_id = ? AND revoked_at IS NULL').bind(tripId, user.id).first<{ role: string }>()
  if (!manager || (manager.role !== 'owner' && manager.role !== 'agent')) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
  }
  const result = await db.prepare('SELECT m.id, m.user_id, u.email, u.display_name, m.role, m.created_at FROM trip_memberships m JOIN users u ON u.id = m.user_id WHERE m.trip_id = ? AND m.revoked_at IS NULL ORDER BY CASE m.role WHEN \'owner\' THEN 0 WHEN \'agent\' THEN 1 WHEN \'editor\' THEN 2 ELSE 3 END, m.created_at').bind(tripId).all<MemberRow>()
  setHeader(event, 'Cache-Control', 'no-store')
  return {
    members: (result.results ?? []).map((member) => ({
      id: member.id,
      userId: member.user_id,
      email: member.email,
      displayName: member.display_name,
      role: member.role,
      createdAt: member.created_at,
      removable: member.role === 'editor' || member.role === 'viewer',
    })),
  }
})
