import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTripStore } from '~/stores/trip'
import { commitSetupToTrip } from '~/utils/setupCommit'
import type { SetupDraft } from '~/stores/setup'

function draft(mode: 'self' | 'booked' | 'guided'): SetupDraft {
  return { version: 1, mode, step: 3, templateId: 'blank', bookedFacts: [], party: 'mixed', pace: 'balanced', priorities: mode === 'guided' ? ['Universal parks'] : [], accessibility: '', thrillLevel: 'mixed', heatTolerance: 'medium', mustDoParks: [], bookings: [], name: 'Test trip', startDate: '2027-06-01', endDate: '2027-06-14', weekStart: 'monday', hotels: [], ticketDays: { disney: 0, universal: 0 }, parkHopper: false, flights: [], carHire: '' }
}

describe('setup commit', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('commits booked facts as date-fixed anchors once', () => {
    const setup = draft('booked')
    setup.bookings.push({ id: 'setup-booking', title: 'Dinner', date: '2027-06-05', time: '18:00', parkId: 'ep', kind: 'dining' })
    const store = useTripStore()
    expect(commitSetupToTrip(store, setup)).toBeTruthy()
    expect(store.days[4]!.items[0]).toMatchObject({ title: 'Dinner', anchor: 'date', state: 'booked', parkId: 'ep' })
  })
  it('uses the explained guided recommendation', () => {
    const store = useTripStore()
    commitSetupToTrip(store, draft('guided'))
    expect(store.seedStrategy).toBe('generated')
    expect(store.days.some((day) => ['usf', 'ioa', 'eu'].includes(day.parkId ?? ''))).toBe(true)
  })
})
