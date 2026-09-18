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

  it('keeps the most recently chosen activities available to the editor', () => {
    const store = useTripStore()
    store.$patch(blank14DayTrip())

    store.setDayActivities(0, 'epcot')
    store.setDayActivities(1, 'magic-kingdom', 'epcot')

    expect(store.recentActivityIds).toEqual(['magic-kingdom', 'epcot'])
  })

  it('copies a movable plan without moving date-fixed detail and supports undo', () => {
    const store = useTripStore()
    store.$patch(blank14DayTrip())
    store.days[0]!.parkId = 'magic-kingdom'
    store.days[0]!.secondParkId = 'epcot'
    store.days[0]!.note = 'Take the early bus'
    store.days[0]!.items = [{
      id: 'booking-1',
      title: 'Breakfast booking',
      time: '08:00',
      kind: 'dining',
      state: 'booked',
      anchor: 'date',
      parkId: 'magic-kingdom',
    }, {
      id: 'idea-1',
      title: 'Watch the parade',
      time: '',
      kind: 'fixed',
      state: 'idea',
      anchor: 'plan',
      parkId: 'magic-kingdom',
    }]
    store.days[1]!.parkId = 'rest'
    store.days[1]!.note = 'Original note'
    store.days[1]!.items = [{
      id: 'booking-2',
      title: 'Hotel check-in',
      time: '15:00',
      kind: 'fixed',
      state: 'booked',
      anchor: 'date',
      parkId: null,
    }]

    store.copyDayPlan(0, 1)

    expect(store.days[1]).toMatchObject({ parkId: 'magic-kingdom', secondParkId: 'epcot' })
    expect(store.days[1]!.note).toBe('Take the early bus')
    expect(store.days[1]!.items.map((item) => item.title)).toEqual(['Hotel check-in', 'Watch the parade'])
    expect(store.days[1]!.items[1]!.id).not.toBe('idea-1')
    expect(store.undo?.label).toBe('Copied plan to day 2')

    store.undoLastChange()
    expect(store.days[1]).toMatchObject({ parkId: 'rest', secondParkId: null })
    expect(store.days[1]!.note).toBe('Original note')
    expect(store.days[1]!.items.map((item) => item.id)).toEqual(['booking-2'])
  })

  it('fills several selected days as one undoable change', () => {
    const store = useTripStore()
    store.$patch(blank14DayTrip())
    store.days[0]!.parkId = 'epcot'
    store.days[0]!.note = 'Festival day'
    store.days[1]!.parkId = 'rest'
    store.days[2]!.parkId = 'pool'

    store.copyDayPlanToMany(0, [1, 2, 2, 0])

    expect(store.days[1]).toMatchObject({ parkId: 'epcot', note: 'Festival day' })
    expect(store.days[2]).toMatchObject({ parkId: 'epcot', note: 'Festival day' })
    expect(store.undo?.label).toBe('Filled 2 days')
    expect(store.undo?.days).toHaveLength(2)

    store.undoLastChange()
    expect(store.days[1]!.parkId).toBe('rest')
    expect(store.days[2]!.parkId).toBe('pool')
  })
})

describe('starting shape safety', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('fills only unset days by default', () => {
    const store = useTripStore()
    store.$patch(blank14DayTrip())
    store.days[2]!.parkId = 'ak'

    store.applyTemplate('disney')

    expect(store.days[2]!.parkId).toBe('ak')
    expect(store.days[1]!.parkId).toBe('mk')
  })

  it('replaces movable content while retaining fixed bookings', () => {
    const store = useTripStore()
    store.$patch(blank14DayTrip())
    store.days[2]!.parkId = 'ak'
    store.days[2]!.note = 'Old plan'
    store.days[2]!.items = [
      { id: 'fixed', title: 'Dinner', time: '18:00', kind: 'dining', state: 'booked', anchor: 'date' },
      { id: 'idea', title: 'Old idea', time: '', kind: 'idea', state: 'idea', anchor: 'plan' },
    ]

    store.applyTemplate('disney', 'replace-movable')

    expect(store.days[2]!.parkId).toBe('ep')
    expect(store.days[2]!.note).toBe('')
    expect(store.days[2]!.items.map((item) => item.id)).toEqual(['fixed'])
  })
})
