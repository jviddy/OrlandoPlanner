import { assertSameOrigin, requireAuthDb, requireSession } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const db = requireAuthDb(event)
  const { user } = await requireSession(event, db)
  const tripId = getRouterParam(event, 'id') ?? ''
  const memberId = getRouterParam(event, 'memberId') ?? ''
  const manager = await db.prepare('SELECT role FROM trip_memberships WHERE trip_id = ? AND user_id = ? AND revoked_at IS NULL').bind(tripId, user.id).first<{ role: string }>()
  if (!manager || (manager.role !== 'owner' && manager.role !== 'agent')) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
  }
  const target = await db.prepare('SELECT m.role, u.display_name, u.email FROM trip_memberships m JOIN users u ON u.id = m.user_id WHERE m.id = ? AND m.trip_id = ? AND m.revoked_at IS NULL').bind(memberId, tripId).first<{ role: string; display_name: string; email: string }>()
  if (!target || (target.role !== 'editor' && target.role !== 'viewer')) {
    throw createError({ statusCode: 400, statusMessage: 'This member cannot be removed here', data: { code: 'member_not_removable' } })
  }
  const now = new Date().toISOString()
  const results = await db.batch([
    db.prepare('UPDATE trip_memberships SET revoked_at = ? WHERE id = ? AND trip_id = ? AND revoked_at IS NULL').bind(now, memberId, tripId),
    db.prepare("INSERT INTO activity_log (trip_id, actor_user_id, actor_display_name, action, summary, created_at) VALUES (?, ?, ?, 'member_removed', ?, ?)").bind(tripId, user.id, user.displayName, `${target.display_name || target.email} removed as ${target.role}`, now),
  ])
  if (!results[0]?.meta?.changes) throw createError({ statusCode: 404, statusMessage: 'Member not found', data: { code: 'member_not_found' } })
  return { ok: true }
})
