import { describe, expect, it } from 'vitest'
import { snapshotTrip } from '~/repositories/tripRepository'
import { parsePersistedTripPayload, TripPayloadError } from '~/utils/tripPayload'
import { blank14DayTrip } from './fixtures/planningTrips'

describe('persisted trip payload', () => {
  it('accepts and returns the exact repository snapshot', () => {
    const snapshot = snapshotTrip(blank14DayTrip())
    expect(parsePersistedTripPayload(snapshot)).toEqual(snapshot)
  })

  it('preserves idea item kinds', () => {
    const trip = blank14DayTrip()
    trip.days[0]!.items.push({ id: 'fixture-idea', title: 'Maybe', time: '', kind: 'idea', state: 'idea', anchor: 'plan', parkId: null })
    const snapshot = snapshotTrip(trip)
    expect(parsePersistedTripPayload(snapshot).days[0]!.items[0]!.kind).toBe('idea')
  })

  it('rejects transient and unknown fields', () => {
    const snapshot = snapshotTrip(blank14DayTrip()) as Record<string, unknown>
    expect(() => parsePersistedTripPayload({ ...snapshot, selectedDay: 2 })).toThrow(TripPayloadError)
    expect(() => parsePersistedTripPayload({ ...snapshot, confirmationNumber: 'secret' })).toThrow(TripPayloadError)
  })

  it('rejects duplicate IDs and malformed nested values', () => {
    const snapshot = snapshotTrip(blank14DayTrip())
    const duplicate = structuredClone(snapshot)
    duplicate.days[1]!.id = duplicate.days[0]!.id
    expect(() => parsePersistedTripPayload(duplicate)).toThrow(/unique/)

    const badTime = structuredClone(snapshot)
    badTime.days[0]!.items.push({ id: 'bad-time', title: 'Bad', time: '25:61', kind: 'fixed', state: 'booked', anchor: 'date', parkId: null })
    expect(() => parsePersistedTripPayload(badTime)).toThrow(/HH:MM/)

    const badDate = structuredClone(snapshot)
    badDate.days[0]!.date = '2027-02-31'
    expect(() => parsePersistedTripPayload(badDate)).toThrow(/ISO date/)
  })
})
