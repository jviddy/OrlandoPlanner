import { requireAuthDb, requireSession } from '../../utils/auth'
import { redactTripPayload, redactionTarget } from '../../utils/tripRedaction'
import { requireMemberTrip } from '../../utils/tripAccess'

export default defineEventHandler(async (event) => {
  const db = requireAuthDb(event)
  const { user } = await requireSession(event, db)
  const row = await requireMemberTrip(db, user.id, getRouterParam(event, 'id') ?? '', 'trip:view')
  const target = redactionTarget(row.role)
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'ETag', String(row.revision))
  return { trip: redactTripPayload(JSON.parse(row.payload_json), target), revision: row.revision, role: row.role, visibility: row.visibility }
})
