import type { useTripStore } from '~/stores/trip'
import type { SetupDraft } from '~/stores/setup'
import { recommendSetup } from '~/utils/setupRecommendation'

export function commitSetupToTrip(store: ReturnType<typeof useTripStore>, setup: SetupDraft): string | null {
  if (!setup.mode || !setup.startDate || !setup.endDate || setup.endDate < setup.startDate) return null
  store.resetTrip()
  const recommendation = recommendSetup(setup)
  const templateId = setup.mode === 'guided' ? recommendation.templateId : setup.templateId
  store.updateFields({
    name: setup.name, startDate: setup.startDate, endDate: setup.endDate, weekStart: setup.weekStart,
    hotels: setup.hotels.map((hotel) => ({ ...hotel })), ticketDays: { ...setup.ticketDays },
    parkHopper: setup.parkHopper, flights: setup.flights.map((flight) => ({ ...flight })), carHire: setup.carHire,
    setupMode: setup.mode,
    seedStrategy: setup.mode === 'guided' ? 'generated' : templateId === 'blank' ? 'blank' : 'template',
  })
  store.applyTemplate(templateId)
  for (const booking of setup.bookings) {
    const index = store.days.findIndex((day) => day.date === booking.date)
    if (index < 0 || !booking.title.trim()) continue
    store.addItem(index, { title: booking.title.trim(), time: booking.time, kind: booking.kind, state: 'booked', anchor: 'date', parkId: booking.parkId || null })
  }
  return (store.days.find((day) => !day.parkId) ?? store.days[0])?.id ?? null
}
