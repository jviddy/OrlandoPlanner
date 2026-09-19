import { requireAuthDb } from '../../utils/auth'
import { redactTripPayload, redactionTarget } from '../../utils/tripRedaction'
import { requireAccessibleTrip } from '../../utils/tripAccess'

export default defineEventHandler(async (event) => {
  const db = requireAuthDb(event)
  const row = await requireAccessibleTrip(event, db, getRouterParam(event, 'id') ?? '', 'trip:view')
  const target = redactionTarget(row.role, row.capabilityKind)
  const canEdit = row.accessKind === 'capability'
    ? row.capabilityKind === 'edit'
    : row.role === 'owner' || row.role === 'agent' || row.role === 'editor'
  const canManageSharing = row.accessKind === 'member' && (row.role === 'owner' || row.role === 'agent')
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'ETag', String(row.revision))
  return { trip: redactTripPayload(JSON.parse(row.payload_json), target), revision: row.revision, role: row.role, visibility: row.visibility, canEdit, canManageSharing }
})
