import { describe, expect, it } from 'vitest'
import legacyTrip from './fixtures/trip-v1.json'
import {
  dateRangeImpact,
  migratePersistedTrip,
  refitDaysWithRecovery,
  type IdFactory,
} from '~/utils/tripSchema'

function deterministicIds(): IdFactory {
  let next = 0
  return (prefix) => `${prefix}-generated-${++next}`
}

describe('trip schema migration', () => {
  it('adds stable identities and preserves legacy content', () => {
    const migrated = migratePersistedTrip(legacyTrip, deterministicIds())

    expect(migrated.version).toBe(3)
    expect(migrated.tripId).toMatch(/^trip-generated-/)
    expect(migrated.days).toHaveLength(3)
    expect(new Set(migrated.days.map((day) => day.id)).size).toBe(3)
    expect(migrated.hotels[0]).toMatchObject({ name: 'Pop Century' })
    expect(migrated.hotels[0]?.id).toMatch(/^stay-generated-/)
    expect(migrated.flights.map((flight) => flight.route)).toEqual(['MAN → MCO', 'MCO → MAN'])
    expect(migrated.flights[0]).toMatchObject({ fromCode: 'MAN', toCode: 'MCO' })
    expect(migrated.flights[1]).toMatchObject({ fromCode: 'MCO', toCode: 'MAN' })
    expect(migrated.days[0]?.secondParkId).toBeNull()
    expect(migrated.days[0]?.items[0]).toMatchObject({ id: 'legacy-flight-item', anchor: 'date' })
    expect(migrated.days[1]?.items[0]).toMatchObject({ id: 'legacy-meal-item', anchor: 'date' })
    expect(migrated.days[2]?.items[0]).toMatchObject({ id: 'legacy-idea-item', anchor: 'plan' })
  })

  it('is idempotent for identities and explicit anchors', () => {
    const first = migratePersistedTrip(legacyTrip, deterministicIds())
    const second = migratePersistedTrip(first, deterministicIds())

    expect(second.tripId).toBe(first.tripId)
    expect(second.days.map((day) => day.id)).toEqual(first.days.map((day) => day.id))
    expect(second.days.flatMap((day) => day.items.map((item) => item.anchor))).toEqual(
      first.days.flatMap((day) => day.items.map((item) => item.anchor)),
    )
  })
})

describe('date range recovery', () => {
  it('reports retained, added, and planned days at risk', () => {
    const trip = migratePersistedTrip(legacyTrip, deterministicIds())
    expect(dateRangeImpact(trip.days, '2027-08-02', '2027-08-04')).toEqual({
      retained: 2,
      added: 1,
      removed: 1,
      removedWithContent: 1,
    })
  })

  it('archives removed days and restores the same identity and content', () => {
    const trip = migratePersistedTrip(legacyTrip, deterministicIds())
    const removedId = trip.days[0]!.id
    const narrowed = refitDaysWithRecovery(
      trip.days,
      [],
      '2027-08-02',
      '2027-08-03',
      deterministicIds(),
    )

    expect(narrowed.days).toHaveLength(2)
    expect(narrowed.removedDays.map((day) => day.id)).toContain(removedId)

    const restored = refitDaysWithRecovery(
      narrowed.days,
      narrowed.removedDays,
      '2027-08-01',
      '2027-08-03',
      deterministicIds(),
    )
    expect(restored.days[0]?.id).toBe(removedId)
    expect(restored.days[0]?.note).toBe('Arrival day')
    expect(restored.removedDays).toHaveLength(0)
  })
})
