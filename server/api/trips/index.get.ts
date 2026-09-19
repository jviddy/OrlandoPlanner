import { requireAuthDb, requireSession } from '../../utils/auth'

interface TripListRow {
  id: string
  status: string
  visibility: string
  revision: number
  payload_json: string
  role: string
  updated_at: string
}

export default defineEventHandler(async (event) => {
  const db = requireAuthDb(event)
  const { user } = await requireSession(event, db)
  const result = await db.prepare('SELECT t.id, t.status, t.visibility, t.revision, t.payload_json, t.updated_at, m.role FROM trips t JOIN trip_memberships m ON m.trip_id = t.id WHERE m.user_id = ? AND m.revoked_at IS NULL AND t.deleted_at IS NULL ORDER BY t.updated_at DESC').bind(user.id).all<TripListRow>()
  const rows = result.results ?? []
  setHeader(event, 'Cache-Control', 'no-store')
  return {
    trips: rows.map((row) => {
      const payload = JSON.parse(row.payload_json)
      return { id: row.id, name: payload.name || 'My Trip', startDate: payload.startDate || '', endDate: payload.endDate || '', status: row.status, visibility: row.visibility, revision: row.revision, role: row.role, updatedAt: row.updated_at }
    }),
  }
})
