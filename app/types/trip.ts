export type ItemKind = 'dining' | 'fixed'
export type ItemState = 'booked' | 'idea'

export interface DayItem {
  id: string
  title: string
  /** 'HH:MM' 24h, or '' for "no time yet". */
  time: string
  kind: ItemKind
  state: ItemState
  /**
   * Set only when the item belongs to a different park than its day
   * (that mismatch is what raises the "reservation in the wrong park" alert).
   */
  parkId?: string | null
}

export interface Day {
  /** ISO date, yyyy-mm-dd. */
  date: string
  /** null = unassigned. */
  parkId: string | null
  note: string
  items: DayItem[]
}

export interface TicketDays {
  disney: number
  universal: number
}

export interface Flight {
  /** Free text, e.g. "MAN → MCO". */
  route: string
  /** 'HH:MM' 24h, or '' for "no time yet". */
  time: string
}

export interface Stay {
  name: string
  /** Optional ISO dates — set only when this stay doesn't cover the whole trip. */
  startDate?: string
  endDate?: string
}

export interface TripState {
  version: number
  /** Flips true once a template has been chosen (trip left the gate). */
  created: boolean

  name: string
  startDate: string
  endDate: string

  /** Split stay: [] | [hotel1] | [hotel1, hotel2]. */
  hotels: Stay[]
  ticketDays: TicketDays
  parkHopper: boolean
  /** [] | [outbound] | [outbound, return] | more, for connections/multi-city. */
  flights: Flight[]
  carHire: string

  days: Day[]

  /** Transient UI: which day the quick-assign sheet / day view is looking at. */
  selectedDay: number | null
  sheetOpen: boolean
  /** Day index to play the "pop" animation on after an assignment. */
  justSet: number | null
}
