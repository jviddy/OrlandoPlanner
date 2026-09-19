import { canPerformTripOperation, type MembershipRole, type TripOperation, type TripStatus } from './tripPermissions'
import type { D1DatabaseLike } from './anonymousTrips'

export interface AccessibleTripRow {
  id: string
  status: TripStatus
  visibility: 'private' | 'unlisted'
  payload_json: string
  payload_schema_version: number
  revision: number
  role: MembershipRole
  updated_at: string
  deleted_at: string | null
}

export async function requireMemberTrip(
  db: D1DatabaseLike,
  userId: string,
  tripId: string,
  operation: TripOperation,
): Promise<AccessibleTripRow> {
  const row = await db.prepare('SELECT t.id, t.status, t.visibility, t.payload_json, t.payload_schema_version, t.revision, t.updated_at, t.deleted_at, m.role FROM trips t JOIN trip_memberships m ON m.trip_id = t.id WHERE t.id = ? AND m.user_id = ? AND m.revoked_at IS NULL AND t.deleted_at IS NULL').bind(tripId, userId).first<AccessibleTripRow>()
  if (!row || !canPerformTripOperation({ kind: 'member', role: row.role }, operation, row.status)) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
  }
  return row
}

export function persistedDetailsSignature(payload: Record<string, unknown>): string {
  return JSON.stringify({
    name: payload.name,
    startDate: payload.startDate,
    endDate: payload.endDate,
    weekStart: payload.weekStart,
    hotels: payload.hotels,
    ticketDays: payload.ticketDays,
    parkHopper: payload.parkHopper,
    flights: payload.flights,
    carHire: payload.carHire,
    setupMode: payload.setupMode,
    seedStrategy: payload.seedStrategy,
    confirmationNumber: payload.confirmationNumber,
    bookingPhone: payload.bookingPhone,
    partySize: payload.partySize,
  })
}
