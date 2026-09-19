import { assertSameOrigin, requireAuthDb, requireSession } from '../../utils/auth'
import { requireMemberTrip } from '../../utils/tripAccess'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const db = requireAuthDb(event)
  const { user } = await requireSession(event, db)
  const tripId = getRouterParam(event, 'id') ?? ''
  const current = await requireMemberTrip(db, user.id, tripId, 'trip:delete')
  const now = new Date().toISOString()
  await db.batch([
    db.prepare("UPDATE trips SET status = 'archived', deleted_at = ?, updated_at = ?, revision = revision + 1 WHERE id = ? AND deleted_at IS NULL").bind(now, now, tripId),
    db.prepare("INSERT INTO activity_log (trip_id, from_revision, to_revision, actor_user_id, actor_display_name, action, summary, created_at) SELECT id, ?, revision, ?, ?, 'delete', 'Trip deleted', ? FROM trips WHERE id = ? AND revision = ?").bind(current.revision, user.id, user.displayName, now, tripId, current.revision + 1),
  ])
  setResponseStatus(event, 204)
  return null
})
