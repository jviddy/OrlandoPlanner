import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTripStore } from '~/stores/trip'
import { blank14DayTrip } from './fixtures/planningTrips'

describe('trip assignment history', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('undoes an immediate day assignment by stable day identity', () => {
    const store = useTripStore()
    store.$patch(blank14DayTrip())
    const dayId = store.days[2]!.id

    store.setDayActivities(2, 'magic-kingdom', 'epcot')
    expect(store.days[2]).toMatchObject({ parkId: 'magic-kingdom', secondParkId: 'epcot' })
    expect(store.undo?.days[0]?.dayId).toBe(dayId)

    store.undoLastChange()
    expect(store.days[2]).toMatchObject({ parkId: null, secondParkId: null })
    expect(store.undo).toBeNull()
  })

  it('does not create history for a no-op assignment', () => {
    const store = useTripStore()
    store.$patch(blank14DayTrip())
    store.setDayActivities(0, null)
    expect(store.undo).toBeNull()
  })
})
