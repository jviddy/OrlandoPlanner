import { describe, expect, it } from 'vitest'
import { LocalTripRepository, snapshotTrip } from '~/repositories/tripRepository'
import { blank14DayTrip } from './fixtures/planningTrips'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return { get length() { return values.size }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => { values.delete(key) }, setItem: (key, value) => { values.set(key, value) } }
}

describe('local trip repository', () => {
  it('round-trips a migrated snapshot and removes it by stable ID', async () => {
    const repository = new LocalTripRepository(memoryStorage())
    const trip = snapshotTrip(blank14DayTrip())
    await repository.save(trip)
    expect((await repository.load(trip.tripId))?.days).toHaveLength(14)
    await repository.remove(trip.tripId)
    expect(await repository.load(trip.tripId)).toBeNull()
  })

  it('migrates the legacy singleton key without deleting its rollback copy', async () => {
    const storage = memoryStorage()
    const trip = blank14DayTrip()
    storage.setItem('orlando-trip', JSON.stringify(trip))
    const repository = new LocalTripRepository(storage)
    const loaded = await repository.loadCurrent()
    expect(loaded?.tripId).toBe(trip.tripId)
    expect(storage.getItem('orlando-trip')).not.toBeNull()
    expect(storage.getItem('orlando-trip-v2:current')).toBe(trip.tripId)
    expect(await repository.load(trip.tripId)).not.toBeNull()
  })
})
