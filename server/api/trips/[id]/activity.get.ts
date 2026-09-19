import { bearer, requireAnonymousDb, tokenHash } from '../../../utils/anonymousTrips'
import { requireAuthDb, requireSession } from '../../../utils/auth'
import { requireMemberTrip } from '../../../utils/tripAccess'

interface ActivityRow {
  id: string
  from_revision: number | null
  to_revision: number | null
  actor_user_id: string | null
  actor_display_name: string | null
  action: string
  summary: string
  created_at: string
}

export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, 'id') ?? ''

  // Try session auth first (owned trips).
  let rows: ActivityRow[] = []
  try {
    const db = requireAuthDb(event)
    const { user } = await requireSession(event, db)
    await requireMemberTrip(db, user.id, tripId, 'trip:view')
    const result = await db.prepare('SELECT id, from_revision, to_revision, actor_user_id, actor_display_name, action, summary, created_at FROM activity_log WHERE trip_id = ? ORDER BY created_at DESC LIMIT 100').bind(tripId).all<ActivityRow>()
    rows = result.results ?? []
  } catch (authError: any) {
    // If session auth fails with 401/404, try anonymous bearer auth.
    if (authError?.statusCode !== 401 && authError?.statusCode !== 404) throw authError

    const db = requireAnonymousDb(event)
    const hash = await tokenHash(bearer(event))
    const now = new Date().toISOString()
    const capability = await db.prepare("SELECT c.id FROM trip_capabilities c JOIN trips t ON t.id = c.trip_id WHERE t.id = ? AND t.deleted_at IS NULL AND c.kind = 'view' AND c.token_hash = ? AND c.revoked_at IS NULL AND c.expires_at > ?").bind(tripId, hash, now).first<{ id: string }>()
    if (!capability) throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
    const result = await db.prepare('SELECT id, from_revision, to_revision, actor_user_id, actor_display_name, action, summary, created_at FROM activity_log WHERE trip_id = ? ORDER BY created_at DESC LIMIT 100').bind(tripId).all<ActivityRow>()
    rows = result.results ?? []
  }

  setHeader(event, 'Cache-Control', 'no-store')
  return { activity: rows }
})
