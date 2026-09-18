import type { Day, TripState } from '~/types/trip'

export type ShareStory = 'overview' | 'weeks' | 'pacing'
export type ShareFormat = 'portrait' | 'square'

export interface SharePrivacy {
  includeTripName: boolean
  includeSafeDetails: boolean
}

export interface ShareDay {
  id: string
  date: string
  parkId: string | null
  secondParkId: string | null
  summaries: string[]
}

export interface SharePage {
  number: number
  total: number
  title: string
  range: string
  story: ShareStory
  days: ShareDay[]
}

function safeSummaries(day: Day): string[] {
  const summaries: string[] = []
  if (day.items.some((item) => item.kind === 'dining')) summaries.push('Dining booked')
  if (day.items.some((item) => item.kind === 'fixed')) summaries.push('Fixed event')
  if (day.parkId === 'travel') summaries.push('Travel day')
  return summaries
}

export function presentShareTrip(
  trip: Pick<TripState, 'name' | 'startDate' | 'endDate' | 'days'>,
  story: ShareStory,
  privacy: SharePrivacy,
): { pages: SharePage[]; caption: string; included: string[]; excluded: string[] } {
  const title = privacy.includeTripName && trip.name.trim() ? trip.name.trim() : 'Our Orlando trip'
  const size = story === 'overview' || story === 'pacing' ? 21 : 7
  const safeDays = trip.days.map((day) => ({
    id: day.id, date: day.date, parkId: day.parkId, secondParkId: day.secondParkId,
    summaries: privacy.includeSafeDetails ? safeSummaries(day) : [],
  }))
  const groups = Array.from({ length: Math.max(1, Math.ceil(safeDays.length / size)) }, (_, index) => safeDays.slice(index * size, (index + 1) * size))
  const pages = groups.map((days, index) => ({
    number: index + 1,
    total: groups.length,
    title,
    range: `${trip.startDate} → ${trip.endDate}`,
    story,
    days,
  }))
  const question = story === 'pacing' ? 'How does this pacing look?' : story === 'weeks' ? 'What would you change in our plan?' : 'Here is our Orlando trip plan.'
  return {
    pages,
    caption: `${question}\n\n${trip.days.length} days planned with Orlando Planner.`,
    included: ['Trip dates', 'Park, rest and travel plan', ...(privacy.includeTripName ? ['Trip name'] : []), ...(privacy.includeSafeDetails ? ['Safe booking summaries'] : [])],
    excluded: ['Notes', 'Confirmation numbers', 'Hotel names', 'Flight routes and times', 'Booking titles'],
  }
}
