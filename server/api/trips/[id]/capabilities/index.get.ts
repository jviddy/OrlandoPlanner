import { requireAuthDb, requireSession } from '../../../../utils/auth'

interface CapabilityRow {
  id: string
  kind: 'view' | 'edit'
  expires_at: string
  created_at: string
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

  const result = await db.prepare('SELECT id, kind, expires_at, created_at, revoked_at FROM trip_capabilities WHERE trip_id = ? ORDER BY created_at DESC').bind(tripId).all<CapabilityRow>()
  const caps = (result.results ?? []).filter((c) => !c.revoked_at && new Date(c.expires_at) > new Date())

  setHeader(event, 'Cache-Control', 'no-store')
  return { capabilities: caps.map((c) => ({ id: c.id, kind: c.kind, expiresAt: c.expires_at, createdAt: c.created_at })) }
})
