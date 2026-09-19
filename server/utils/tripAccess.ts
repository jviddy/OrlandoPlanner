import { canPerformTripOperation, type MembershipRole, type TripOperation, type TripStatus } from './tripPermissions'
import type { D1DatabaseLike } from './anonymousTrips'
import type { H3Event } from 'h3'

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

export interface CapabilityAccessibleTripRow extends AccessibleTripRow {
  accessKind: 'member' | 'capability'
  capabilityId?: string
  capabilityKind?: 'view' | 'edit'
  actorUserId?: string
  actorDisplayName?: string
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

interface CapabilityRow {
  id: string
  trip_id: string
  kind: 'view' | 'edit'
  token_hash: string
  expires_at: string
  revoked_at: string | null
}

export async function requireAccessibleTrip(
  event: H3Event,
  db: D1DatabaseLike,
  tripId: string,
  operation: TripOperation,
): Promise<CapabilityAccessibleTripRow> {
  // 1. Try authenticated member access first.
  const session = await trySession(event, db)
  if (session) {
    try {
      const row = await requireMemberTrip(db, session.user.id, tripId, operation)
      return { ...row, accessKind: 'member', actorUserId: session.user.id, actorDisplayName: session.user.displayName }
    } catch (err: any) {
      // If no member access, fall through to capability check rather than leaking membership existence.
      if (err?.data?.code !== 'trip_not_found') throw err
    }
  }

  // 2. Try capability token access.
  const token = readCapabilityToken(event)
  if (!token) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
  }
  const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
    .then((hash) => Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join(''))
  const cap = await db.prepare('SELECT id, trip_id, kind, token_hash, expires_at, revoked_at FROM trip_capabilities WHERE trip_id = ? AND token_hash = ?').bind(tripId, tokenHash).first<CapabilityRow>()
  if (!cap || cap.revoked_at || new Date(cap.expires_at) <= new Date()) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
  }
  const neededKind = operation === 'trip:view' ? 'view' : 'edit'
  if (cap.kind !== 'edit' && cap.kind !== neededKind) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
  }

  const row = await db.prepare('SELECT t.id, t.status, t.visibility, t.payload_json, t.payload_schema_version, t.revision, t.updated_at, t.deleted_at FROM trips t WHERE t.id = ? AND t.status = ? AND t.deleted_at IS NULL').bind(tripId, 'owned').first<Omit<AccessibleTripRow, 'role'>>()
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found', data: { code: 'trip_not_found' } })
  }

  return {
    ...row,
    role: 'viewer',
    accessKind: 'capability',
    capabilityId: cap.id,
    capabilityKind: cap.kind,
  }
}

async function trySession(event: H3Event, db: D1DatabaseLike): Promise<{ user: { id: string; displayName: string } } | null> {
  try {
    const { requireSession } = await import('./auth')
    const { user } = await requireSession(event, db)
    return { user }
  } catch {
    return null
  }
}

function readCapabilityToken(event: H3Event): string {
  const auth = getHeader(event, 'authorization') ?? ''
  if (auth.startsWith('Bearer ')) return auth.slice(7)
  const query = getQuery(event)
  return String(query.cap ?? query.capability ?? '')
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
