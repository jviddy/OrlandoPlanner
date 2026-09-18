import { addDays, diffDays, parseISO, toISO } from '~/composables/useDates'
import type { Day, DayItem, Flight, Stay, TripState } from '~/types/trip'

export const TRIP_SCHEMA_VERSION = 2

export type IdFactory = (prefix: 'trip' | 'day' | 'stay' | 'flight' | 'item') => string

export function createStableId(prefix: Parameters<IdFactory>[0]): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}-${random}`
}

function uniqueId(
  candidate: unknown,
  prefix: Parameters<IdFactory>[0],
  used: Set<string>,
  makeId: IdFactory,
): string {
  const value = typeof candidate === 'string' ? candidate.trim() : ''
  if (value && !used.has(value)) {
    used.add(value)
    return value
  }
  let next = makeId(prefix)
  while (used.has(next)) next = makeId(prefix)
  used.add(next)
  return next
}

function migrateItem(raw: any, used: Set<string>, makeId: IdFactory): DayItem {
  const kind = raw?.kind === 'fixed' ? 'fixed' : 'dining'
  const state = raw?.state === 'booked' ? 'booked' : 'idea'
  return {
    id: uniqueId(raw?.id, 'item', used, makeId),
    title: typeof raw?.title === 'string' ? raw.title : '',
    time: typeof raw?.time === 'string' ? raw.time : '',
    kind,
    state,
    anchor:
      raw?.anchor === 'date' || raw?.anchor === 'plan'
        ? raw.anchor
        : kind === 'fixed' || state === 'booked'
          ? 'date'
          : 'plan',
    parkId: typeof raw?.parkId === 'string' ? raw.parkId : null,
  }
}

function migrateDay(raw: any, used: Set<string>, makeId: IdFactory): Day {
  return {
    id: uniqueId(raw?.id, 'day', used, makeId),
    date: typeof raw?.date === 'string' ? raw.date : '',
    parkId: typeof raw?.parkId === 'string' ? raw.parkId : null,
    secondParkId: typeof raw?.secondParkId === 'string' ? raw.secondParkId : null,
    thirdParkId: typeof raw?.thirdParkId === 'string' ? raw.thirdParkId : null,
    note: typeof raw?.note === 'string' ? raw.note : '',
    items: Array.isArray(raw?.items)
      ? raw.items.map((item: unknown) => migrateItem(item, used, makeId))
      : [],
  }
}

function migrateFlights(rawFlights: unknown, used: Set<string>, makeId: IdFactory): Flight[] {
  let source: unknown[]
  if (Array.isArray(rawFlights)) {
    source = rawFlights
  } else {
    const old = (rawFlights ?? {}) as { out?: unknown; back?: unknown }
    source = [old.out, old.back].filter(
      (value): value is string => typeof value === 'string' && value.trim() !== '',
    )
  }

  return source.map((raw: any) => {
    const legacyRoute = typeof raw === 'string' ? raw : raw?.route
    return {
      id: uniqueId(raw?.id, 'flight', used, makeId),
      route: typeof legacyRoute === 'string' ? legacyRoute : '',
      date: typeof raw?.date === 'string' ? raw.date : '',
      departTime:
        typeof raw?.departTime === 'string'
          ? raw.departTime
          : typeof raw?.time === 'string'
            ? raw.time
            : '',
      arriveTime: typeof raw?.arriveTime === 'string' ? raw.arriveTime : '',
    }
  })
}

function migrateStays(rawStays: unknown, used: Set<string>, makeId: IdFactory): Stay[] {
  if (!Array.isArray(rawStays)) return []
  return rawStays.map((raw: any) => ({
    id: uniqueId(raw?.id, 'stay', used, makeId),
    name: typeof raw === 'string' ? raw : typeof raw?.name === 'string' ? raw.name : '',
    ...(typeof raw?.startDate === 'string' ? { startDate: raw.startDate } : {}),
    ...(typeof raw?.endDate === 'string' ? { endDate: raw.endDate } : {}),
  }))
}

/**
 * Return only persisted fields. Pinia can safely merge this over its fresh
 * state without overwriting transient sheet/selection state.
 */
export function migratePersistedTrip(raw: any, makeId: IdFactory = createStableId) {
  const used = new Set<string>()
  const recoveryDays = Array.isArray(raw?.recovery?.removedDays)
    ? raw.recovery.removedDays.map((day: unknown) => migrateDay(day, used, makeId))
    : []

  return {
    version: TRIP_SCHEMA_VERSION,
    tripId: uniqueId(raw?.tripId, 'trip', used, makeId),
    created: Boolean(raw?.created),
    setupMode: raw?.setupMode === 'booked' || raw?.setupMode === 'guided' ? raw.setupMode : 'self',
    seedStrategy: raw?.seedStrategy === 'template' || raw?.seedStrategy === 'generated' ? raw.seedStrategy : 'blank',
    name: typeof raw?.name === 'string' ? raw.name : 'My Trip',
    startDate: typeof raw?.startDate === 'string' ? raw.startDate : '',
    endDate: typeof raw?.endDate === 'string' ? raw.endDate : '',
    weekStart:
      raw?.weekStart === 'sunday' || raw?.weekStart === 'tripDay1'
        ? raw.weekStart
        : 'monday',
    hotels: migrateStays(raw?.hotels, used, makeId),
    ticketDays: {
      disney: Number(raw?.ticketDays?.disney) || 0,
      universal: Number(raw?.ticketDays?.universal) || 0,
    },
    parkHopper: Boolean(raw?.parkHopper),
    flights: migrateFlights(raw?.flights, used, makeId),
    carHire: typeof raw?.carHire === 'string' ? raw.carHire : '',
    days: Array.isArray(raw?.days)
      ? raw.days.map((day: unknown) => migrateDay(day, used, makeId))
      : [],
    customActivities: Array.isArray(raw?.customActivities) ? raw.customActivities : [],
    recovery: {
      removedDays: recoveryDays,
      updatedAt: typeof raw?.recovery?.updatedAt === 'string' ? raw.recovery.updatedAt : '',
    },
  } satisfies Pick<
    TripState,
    | 'version'
    | 'tripId'
    | 'created'
    | 'setupMode'
    | 'seedStrategy'
    | 'name'
    | 'startDate'
    | 'endDate'
    | 'weekStart'
    | 'hotels'
    | 'ticketDays'
    | 'parkHopper'
    | 'flights'
    | 'carHire'
    | 'days'
    | 'customActivities'
    | 'recovery'
  >
}

function hasPlanningContent(day: Day): boolean {
  return Boolean(day.parkId || day.secondParkId || day.thirdParkId || day.note.trim() || day.items.length)
}

export interface DateRangeImpact {
  retained: number
  added: number
  removed: number
  removedWithContent: number
}

export function dateRangeImpact(days: Day[], startDate: string, endDate: string): DateRangeImpact {
  if (!startDate || !endDate || endDate < startDate) {
    return { retained: 0, added: 0, removed: days.length, removedWithContent: days.filter(hasPlanningContent).length }
  }
  const requested = new Set<string>()
  const start = parseISO(startDate)
  const count = diffDays(parseISO(endDate), start) + 1
  for (let index = 0; index < count; index++) requested.add(toISO(addDays(start, index)))
  const retained = days.filter((day) => requested.has(day.date)).length
  const removedDays = days.filter((day) => !requested.has(day.date))
  return {
    retained,
    added: Math.max(0, requested.size - retained),
    removed: removedDays.length,
    removedWithContent: removedDays.filter(hasPlanningContent).length,
  }
}

export function refitDaysWithRecovery(
  currentDays: Day[],
  archivedDays: Day[],
  startDate: string,
  endDate: string,
  makeId: IdFactory = createStableId,
): { days: Day[]; removedDays: Day[]; archiveChanged: boolean } {
  if (!startDate || !endDate || endDate < startDate) {
    return { days: currentDays, removedDays: archivedDays, archiveChanged: false }
  }

  const currentByDate = new Map(currentDays.map((day) => [day.date, day]))
  const archivedByDate = new Map(archivedDays.map((day) => [day.date, day]))
  const requested = new Set<string>()
  const days: Day[] = []
  const start = parseISO(startDate)
  const count = diffDays(parseISO(endDate), start) + 1

  for (let index = 0; index < count; index++) {
    const date = toISO(addDays(start, index))
    requested.add(date)
    days.push(
      currentByDate.get(date) ??
        archivedByDate.get(date) ?? {
          id: makeId('day'),
          date,
          parkId: null,
          secondParkId: null,
          thirdParkId: null,
          note: '',
          items: [],
        },
    )
  }

  const removedByDate = new Map<string, Day>()
  for (const day of archivedDays) {
    if (!requested.has(day.date)) removedByDate.set(day.date, day)
  }
  for (const day of currentDays) {
    if (!requested.has(day.date)) removedByDate.set(day.date, day)
  }
  const removedDays = [...removedByDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  const previousSignature = archivedDays.map((day) => `${day.id}:${day.date}`).join('|')
  const nextSignature = removedDays.map((day) => `${day.id}:${day.date}`).join('|')

  return { days, removedDays, archiveChanged: previousSignature !== nextSignature }
}
