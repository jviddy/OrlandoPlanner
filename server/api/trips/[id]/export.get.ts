import { requireAuthDb, requireSession } from '../../../utils/auth'
import { requireMemberTrip } from '../../../utils/tripAccess'

export default defineEventHandler(async (event) => {
  const db = requireAuthDb(event)
  const { user } = await requireSession(event, db)
  const tripId = getRouterParam(event, 'id') ?? ''
  const row = await requireMemberTrip(db, user.id, tripId, 'trip:view')

  const payload = JSON.parse(row.payload_json)
  const filename = `${(payload.name || tripId).replace(/[^a-zA-Z0-9_-]/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`

  setHeader(event, 'Content-Type', 'application/json')
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
  setHeader(event, 'Cache-Control', 'no-store')
  return payload
})
