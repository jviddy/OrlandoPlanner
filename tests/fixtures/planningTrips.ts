import type { Day, TripState } from '~/types/trip'

const DAY = 86_400_000

function iso(start: string, offset: number): string {
  return new Date(Date.parse(`${start}T00:00:00Z`) + offset * DAY).toISOString().slice(0, 10)
}

function days(start: string, length: number): Day[] {
  return Array.from({ length }, (_, index) => ({
    id: `fixture-day-${length}-${index + 1}`,
    date: iso(start, index),
    parkId: null,
    secondParkId: null,
    note: '',
    items: [],
  }))
}

function base(name: string, start: string, length: number): TripState {
  return {
    version: 2,
    tripId: `fixture-trip-${length}`,
    created: true,
    name,
    startDate: start,
    endDate: iso(start, length - 1),
    weekStart: 'monday',
    hotels: [],
    ticketDays: { disney: 0, universal: 0 },
    parkHopper: false,
    flights: [],
    carHire: '',
    days: days(start, length),
    customActivities: [],
    recovery: { removedDays: [], updatedAt: '' },
    selectedDay: null,
    sheetOpen: false,
    justSet: null,
  }
}

export function blank14DayTrip(): TripState {
  return base('Blank 14-day trip', '2027-07-03', 14)
}

export function booked17DayTrip(): TripState {
  const trip = base('Booked split-stay trip', '2027-08-01', 17)
  trip.ticketDays = { disney: 7, universal: 4 }
  trip.parkHopper = true
  trip.hotels = [
    { id: 'fixture-stay-1', name: 'Universal hotel', startDate: trip.startDate, endDate: iso(trip.startDate, 5) },
    { id: 'fixture-stay-2', name: 'Disney hotel', startDate: iso(trip.startDate, 5), endDate: trip.endDate },
  ]
  trip.flights = [
    { id: 'fixture-flight-out', route: 'MAN → MCO', date: trip.startDate, departTime: '10:10', arriveTime: '15:10' },
    { id: 'fixture-flight-back', route: 'MCO → MAN', date: trip.endDate, departTime: '18:30', arriveTime: '07:25' },
  ]
  trip.days[3]!.parkId = 'islands-of-adventure'
  trip.days[3]!.items.push({ id: 'fixture-booking-1', title: 'Character meal', time: '12:30', kind: 'dining', state: 'booked', anchor: 'date', parkId: 'islands-of-adventure' })
  trip.days[10]!.items.push({ id: 'fixture-booking-2', title: 'Evening tour', time: '18:00', kind: 'fixed', state: 'booked', anchor: 'date', parkId: 'epcot' })
  return trip
}

export function dense21DayTrip(): TripState {
  const trip = base('Dense 21-day trip', '2027-10-02', 21)
  const pattern = ['magic-kingdom', 'epcot', null, 'universal-studios', 'islands-of-adventure', null, 'animal-kingdom']
  trip.ticketDays = { disney: 8, universal: 5 }
  trip.parkHopper = true
  trip.days.forEach((day, index) => {
    day.parkId = pattern[index % pattern.length] ?? null
    if (index === 8) day.secondParkId = 'hollywood-studios'
    if (index % 4 === 1) day.note = 'Return to the hotel for an afternoon break.'
    if (index % 3 === 0) {
      day.items.push({ id: `fixture-item-${index}`, title: 'Dinner booking', time: '18:30', kind: 'dining', state: 'booked', anchor: 'date', parkId: day.parkId })
    }
  })
  trip.days[12]!.items.push({ id: 'fixture-warning-item', title: 'Wrong-park reservation', time: '10:00', kind: 'fixed', state: 'booked', anchor: 'date', parkId: 'epcot' })
  return trip
}
