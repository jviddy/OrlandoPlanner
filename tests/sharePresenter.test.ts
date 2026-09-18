import { describe, expect, it } from 'vitest'
import { dense21DayTrip } from './fixtures/planningTrips'
import { presentShareTrip } from '~/utils/sharePresenter'

describe('share presenter privacy and pagination', () => {
  it('uses a generic title and never exposes raw notes or booking titles by default', () => {
    const trip = dense21DayTrip()
    const result = presentShareTrip(trip, 'overview', { includeTripName: false, includeSafeDetails: false })
    const serialized = JSON.stringify(result)
    expect(result.pages[0]!.title).toBe('Our Orlando trip')
    expect(serialized).not.toContain(trip.name)
    expect(serialized).not.toContain('Wrong-park reservation')
    expect(serialized).not.toContain('Return to the hotel')
  })

  it('paginates week-by-week output and only includes categorical booking summaries', () => {
    const result = presentShareTrip(dense21DayTrip(), 'weeks', { includeTripName: true, includeSafeDetails: true })
    expect(result.pages).toHaveLength(3)
    expect(result.pages.every((page) => page.days.length === 7)).toBe(true)
    expect(result.pages.flatMap((page) => page.days).flatMap((day) => day.summaries)).toContain('Dining booked')
    expect(JSON.stringify(result)).not.toContain('Dinner booking')
  })
})
