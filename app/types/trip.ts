import type { AttractionType } from '~/data/attractions'

export interface TripInfo {
  name: string
  /** ISO date (YYYY-MM-DD) of the first park day. */
  startDate: string
  nights: number
  partySize: number
  homeBase: string
  notes: string
}

export interface ItineraryItem {
  id: string
  title: string
  type: AttractionType | 'break' | 'travel' | 'other'
  /** Optional catalog link. */
  attractionId?: string
  /** Optional HH:MM 24h start time. */
  time?: string
  durationMin?: number
  note?: string
  done: boolean
}

export interface PlannerDay {
  parkId: string | null
  note: string
  items: ItineraryItem[]
}

export type BudgetCategory =
  | 'Tickets'
  | 'Hotel'
  | 'Flights'
  | 'Car & transport'
  | 'Food & drink'
  | 'Merchandise'
  | 'Extras & experiences'
  | 'Other'

export interface BudgetItem {
  id: string
  label: string
  category: BudgetCategory
  amount: number
  /** 0-based day index, or null for a whole-trip cost. */
  day: number | null
  paid: boolean
}

export interface PackingItem {
  id: string
  label: string
  category: string
  done: boolean
}

export interface TripState {
  version: number
  trip: TripInfo
  days: PlannerDay[]
  budgetTotal: number
  budget: BudgetItem[]
  packing: PackingItem[]
  packingSeeded: boolean
}

export const BUDGET_CATEGORIES: BudgetCategory[] = [
  'Tickets',
  'Hotel',
  'Flights',
  'Car & transport',
  'Food & drink',
  'Merchandise',
  'Extras & experiences',
  'Other',
]
