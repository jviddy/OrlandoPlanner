import type { CustomActivity } from '~/data/parks'

export type WeekStart = 'sunday' | 'monday' | 'tripDay1'

export type ItemKind = 'dining' | 'fixed' | 'idea'
export type ItemState = 'booked' | 'idea'
export type ItemAnchor = 'date' | 'plan'

export interface DayItem {
  id: string
  title: string
  /** 'HH:MM' 24h, or '' for "no time yet". */
  time: string
  kind: ItemKind
  state: ItemState
  /** Date-fixed bookings stay on their real date; movable ideas travel with a future day reorder. */
  anchor: ItemAnchor
  /**
   * Set only when the item belongs to a different park than its day
   * (that mismatch is what raises the "reservation in the wrong park" alert).
   */
  parkId?: string | null
}

export interface Day {
  /** Stable local identity. The calendar date may change in later planning workflows. */
  id: string
  /** ISO date, yyyy-mm-dd. */
  date: string
  /** null = unassigned. */
  parkId: string | null
  /** Optional second park, for a park-hopper day. Only meaningful with `parkId` set. */
  secondParkId: string | null
  note: string
  items: DayItem[]
}

export interface TicketDays {
  disney: number
  universal: number
}

export interface Flight {
  id: string
  /** Free text, e.g. "MAN → MCO". */
  route: string
  /** ISO date, or '' if not set. */
  date: string
  /** 'HH:MM' 24h, or '' for "no time yet". */
  departTime: string
  arriveTime: string
}

export interface Stay {
  id: string
  name: string
  /** Optional ISO dates — set only when this stay doesn't cover the whole trip. */
  startDate?: string
  endDate?: string
}

/** Editable trip metadata used by forms before changes are committed. */
export interface TripDetailsDraft {
  name: string
  startDate: string
  endDate: string
  weekStart: WeekStart
  hotels: Stay[]
  ticketDays: TicketDays
  parkHopper: boolean
  flights: Flight[]
  carHire: string
}

export interface UndoEntry {
  label: string
  days: Array<{
    dayId: string
    parkId: string | null
    secondParkId: string | null
    /** Present for commands that also change the rest of the movable plan. */
    note?: string
    items?: DayItem[]
  }>
}

export interface TripState {
  version: number
  /** Stable identity used by the repository boundary and future URLs. */
  tripId: string
  /** Flips true once a template has been chosen (trip left the gate). */
  created: boolean

  name: string
  startDate: string
  endDate: string
  /** Which day starts a row in the overview grid. */
  weekStart: WeekStart

  /** Split stay: [] | [hotel1] | [hotel1, hotel2]. */
  hotels: Stay[]
  ticketDays: TicketDays
  parkHopper: boolean
  /** [] | [outbound] | [outbound, return] | more, for connections/multi-city. */
  flights: Flight[]
  carHire: string

  days: Day[]

  /** User-defined off-park options, added from the quick-assign sheet. */
  customActivities: CustomActivity[]

  /** Days removed by a date-range change, retained so the user can recover them. */
  recovery: {
    removedDays: Day[]
    updatedAt: string
  }

  /** Transient UI: which day the quick-assign sheet / day view is looking at. */
  selectedDay: number | null
  sheetOpen: boolean
  /** Day index to play the "pop" animation on after an assignment. */
  justSet: number | null
  /** Transient single-step history for immediate planning actions. */
  undo: UndoEntry | null
  /** Transient most-recently chosen activities for the continuous editor. */
  recentActivityIds: string[]
}
