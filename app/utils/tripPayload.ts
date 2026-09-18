import type { CustomActivity } from '~/data/parks'
import type { Day, DayItem, Flight, Stay } from '~/types/trip'
import { migratePersistedTrip, TRIP_SCHEMA_VERSION } from '~/utils/tripSchema'

export type PersistedTripPayload = ReturnType<typeof migratePersistedTrip>

const ROOT_KEYS = [
  'version', 'tripId', 'created', 'setupMode', 'seedStrategy', 'name',
  'startDate', 'endDate', 'weekStart', 'hotels', 'ticketDays', 'parkHopper',
  'flights', 'carHire', 'days', 'customActivities', 'recovery',
] as const

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const MAX_PAYLOAD_BYTES = 250_000

export class TripPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TripPayloadError'
  }
}

function fail(path: string, message: string): never {
  throw new TripPayloadError(`${path}: ${message}`)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object')
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key))
  if (unknown.length) fail(path, `contains unsupported field ${unknown[0]}`)
}

function string(value: unknown, path: string, max: number, allowEmpty = true): string {
  if (typeof value !== 'string') fail(path, 'must be a string')
  if (!allowEmpty && !value.trim()) fail(path, 'must not be empty')
  if (value.length > max) fail(path, `must be at most ${max} characters`)
  return value
}

function nullableString(value: unknown, path: string, max: number): string | null {
  return value === null ? null : string(value, path, max)
}

function isoDate(value: unknown, path: string, allowEmpty = false): string {
  const result = string(value, path, 10, allowEmpty)
  if (result || !allowEmpty) {
    const parsed = new Date(`${result}T00:00:00Z`)
    if (!ISO_DATE.test(result) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) fail(path, 'must be an ISO date')
  }
  return result
}

function id(value: unknown, path: string, used: Set<string>): string {
  const result = string(value, path, 160, false)
  if (result !== result.trim()) fail(path, 'must not have surrounding whitespace')
  if (used.has(result)) fail(path, 'must be unique within the trip')
  used.add(result)
  return result
}

function array(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array')
  if (value.length > max) fail(path, `must contain at most ${max} entries`)
  return value
}

function parseItem(value: unknown, path: string, used: Set<string>): DayItem {
  const item = record(value, path)
  exactKeys(item, ['id', 'title', 'time', 'kind', 'state', 'anchor', 'parkId'], path)
  const kind = item.kind
  if (kind !== 'dining' && kind !== 'fixed' && kind !== 'idea') fail(`${path}.kind`, 'is unsupported')
  const state = item.state
  if (state !== 'booked' && state !== 'idea') fail(`${path}.state`, 'is unsupported')
  const anchor = item.anchor
  if (anchor !== 'date' && anchor !== 'plan') fail(`${path}.anchor`, 'is unsupported')
  const time = string(item.time, `${path}.time`, 5)
  if (time && !TIME.test(time)) fail(`${path}.time`, 'must be HH:MM or empty')
  return {
    id: id(item.id, `${path}.id`, used),
    title: string(item.title, `${path}.title`, 300),
    time,
    kind,
    state,
    anchor,
    parkId: nullableString(item.parkId, `${path}.parkId`, 160),
  }
}

function parseDay(value: unknown, path: string, used: Set<string>): Day {
  const day = record(value, path)
  exactKeys(day, ['id', 'date', 'parkId', 'secondParkId', 'thirdParkId', 'note', 'items'], path)
  return {
    id: id(day.id, `${path}.id`, used),
    date: isoDate(day.date, `${path}.date`),
    parkId: nullableString(day.parkId, `${path}.parkId`, 160),
    secondParkId: nullableString(day.secondParkId, `${path}.secondParkId`, 160),
    thirdParkId: nullableString(day.thirdParkId, `${path}.thirdParkId`, 160),
    note: string(day.note, `${path}.note`, 10_000),
    items: array(day.items, `${path}.items`, 100).map((item, index) => parseItem(item, `${path}.items[${index}]`, used)),
  }
}

function parseStay(value: unknown, path: string, used: Set<string>): Stay {
  const stay = record(value, path)
  exactKeys(stay, ['id', 'name', 'startDate', 'endDate'], path)
  return {
    id: id(stay.id, `${path}.id`, used),
    name: string(stay.name, `${path}.name`, 300),
    ...(stay.startDate === undefined ? {} : { startDate: isoDate(stay.startDate, `${path}.startDate`) }),
    ...(stay.endDate === undefined ? {} : { endDate: isoDate(stay.endDate, `${path}.endDate`) }),
  }
}

function parseFlight(value: unknown, path: string, used: Set<string>): Flight {
  const flight = record(value, path)
  exactKeys(flight, ['id', 'route', 'date', 'departTime', 'arriveTime'], path)
  const departTime = string(flight.departTime, `${path}.departTime`, 5)
  const arriveTime = string(flight.arriveTime, `${path}.arriveTime`, 5)
  if (departTime && !TIME.test(departTime)) fail(`${path}.departTime`, 'must be HH:MM or empty')
  if (arriveTime && !TIME.test(arriveTime)) fail(`${path}.arriveTime`, 'must be HH:MM or empty')
  return {
    id: id(flight.id, `${path}.id`, used),
    route: string(flight.route, `${path}.route`, 300),
    date: isoDate(flight.date, `${path}.date`, true),
    departTime,
    arriveTime,
  }
}

function parseCustomActivity(value: unknown, path: string, used: Set<string>): CustomActivity {
  const activity = record(value, path)
  exactKeys(activity, ['id', 'resort', 'name', 'short', 'glyph'], path)
  if (activity.resort !== 'off') fail(`${path}.resort`, 'must be off')
  return {
    id: id(activity.id, `${path}.id`, used),
    resort: 'off',
    name: string(activity.name, `${path}.name`, 300),
    short: string(activity.short, `${path}.short`, 100),
    glyph: string(activity.glyph, `${path}.glyph`, 5_000),
  }
}

/** Validate and return the exact persisted payload accepted by the trip API. */
export function parsePersistedTripPayload(value: unknown): PersistedTripPayload {
  let bytes = Infinity
  try { bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength } catch { /* handled below */ }
  if (bytes > MAX_PAYLOAD_BYTES) fail('trip', `must be at most ${MAX_PAYLOAD_BYTES} bytes`)

  const trip = record(value, 'trip')
  exactKeys(trip, ROOT_KEYS, 'trip')
  if (trip.version !== TRIP_SCHEMA_VERSION) fail('trip.version', `must be ${TRIP_SCHEMA_VERSION}`)
  if (typeof trip.created !== 'boolean') fail('trip.created', 'must be a boolean')
  if (trip.setupMode !== 'self' && trip.setupMode !== 'booked' && trip.setupMode !== 'guided') fail('trip.setupMode', 'is unsupported')
  if (trip.seedStrategy !== 'blank' && trip.seedStrategy !== 'template' && trip.seedStrategy !== 'generated') fail('trip.seedStrategy', 'is unsupported')
  if (trip.weekStart !== 'monday' && trip.weekStart !== 'sunday' && trip.weekStart !== 'tripDay1') fail('trip.weekStart', 'is unsupported')
  if (typeof trip.parkHopper !== 'boolean') fail('trip.parkHopper', 'must be a boolean')

  const used = new Set<string>()
  const ticketDays = record(trip.ticketDays, 'trip.ticketDays')
  exactKeys(ticketDays, ['disney', 'universal'], 'trip.ticketDays')
  for (const key of ['disney', 'universal'] as const) {
    if (!Number.isInteger(ticketDays[key]) || Number(ticketDays[key]) < 0 || Number(ticketDays[key]) > 60) fail(`trip.ticketDays.${key}`, 'must be an integer from 0 to 60')
  }
  const recovery = record(trip.recovery, 'trip.recovery')
  exactKeys(recovery, ['removedDays', 'updatedAt'], 'trip.recovery')

  const parsed = {
    version: TRIP_SCHEMA_VERSION,
    tripId: id(trip.tripId, 'trip.tripId', used),
    created: trip.created,
    setupMode: trip.setupMode,
    seedStrategy: trip.seedStrategy,
    name: string(trip.name, 'trip.name', 300),
    startDate: isoDate(trip.startDate, 'trip.startDate', true),
    endDate: isoDate(trip.endDate, 'trip.endDate', true),
    weekStart: trip.weekStart,
    hotels: array(trip.hotels, 'trip.hotels', 4).map((stay, index) => parseStay(stay, `trip.hotels[${index}]`, used)),
    ticketDays: { disney: Number(ticketDays.disney), universal: Number(ticketDays.universal) },
    parkHopper: trip.parkHopper,
    flights: array(trip.flights, 'trip.flights', 6).map((flight, index) => parseFlight(flight, `trip.flights[${index}]`, used)),
    carHire: string(trip.carHire, 'trip.carHire', 1_000),
    days: array(trip.days, 'trip.days', 60).map((day, index) => parseDay(day, `trip.days[${index}]`, used)),
    customActivities: array(trip.customActivities, 'trip.customActivities', 100).map((activity, index) => parseCustomActivity(activity, `trip.customActivities[${index}]`, used)),
    recovery: {
      removedDays: array(recovery.removedDays, 'trip.recovery.removedDays', 120).map((day, index) => parseDay(day, `trip.recovery.removedDays[${index}]`, used)),
      updatedAt: string(recovery.updatedAt, 'trip.recovery.updatedAt', 40),
    },
  } satisfies PersistedTripPayload

  if (parsed.startDate && parsed.endDate && parsed.endDate < parsed.startDate) fail('trip.endDate', 'must not be before startDate')
  return parsed
}
