import { defineStore } from 'pinia'
import {
  ATTRACTION_BY_ID,
  type Attraction,
  type AttractionType,
} from '~/data/attractions'
import { PACKING_TEMPLATE } from '~/data/packingTemplate'
import type {
  BudgetItem,
  ItineraryItem,
  PlannerDay,
  PackingItem,
  TripInfo,
  TripState,
} from '~/types/trip'

const STATE_VERSION = 1

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function emptyDay(): PlannerDay {
  return { parkId: null, note: '', items: [] }
}

function defaultTrip(): TripInfo {
  return {
    name: 'Orlando Adventure',
    startDate: '',
    nights: 5,
    partySize: 2,
    homeBase: '',
    notes: '',
  }
}

function makeDays(count: number, existing: PlannerDay[] = []): PlannerDay[] {
  const next: PlannerDay[] = []
  for (let i = 0; i < count; i++) {
    next.push(existing[i] ?? emptyDay())
  }
  return next
}

export const useTripStore = defineStore('orlando-trip', {
  state: (): TripState => ({
    version: STATE_VERSION,
    trip: defaultTrip(),
    days: makeDays(5),
    budgetTotal: 4000,
    budget: [],
    packing: [],
    packingSeeded: false,
  }),

  persist: true,

  getters: {
    dayCount: (s): number => s.days.length,

    /** One entry per park day, with a resolved calendar date when known. */
    schedule: (s) => {
      const base = s.trip.startDate ? new Date(`${s.trip.startDate}T00:00:00`) : null
      return s.days.map((day, index) => {
        let date: Date | null = null
        if (base && !Number.isNaN(base.getTime())) {
          date = new Date(base)
          date.setDate(base.getDate() + index)
        }
        return { index, date, day }
      })
    },

    endDate(): Date | null {
      const entries = this.schedule
      const last = entries[entries.length - 1]
      return last?.date ?? null
    },

    daysUntilStart: (s): number | null => {
      if (!s.trip.startDate) return null
      const start = new Date(`${s.trip.startDate}T00:00:00`)
      if (Number.isNaN(start.getTime())) return null
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      return Math.round((start.getTime() - now.getTime()) / 86_400_000)
    },

    tripIsActive(): boolean {
      const until = this.daysUntilStart
      if (until === null) return false
      return until <= 0 && (this.daysUntilStart ?? 0) > -this.dayCount
    },

    totalPlannedItems: (s): number =>
      s.days.reduce((sum, d) => sum + d.items.length, 0),

    plannedMinutesByDay: (s): number[] =>
      s.days.map((d) =>
        d.items.reduce((sum, it) => sum + (it.durationMin ?? 0), 0),
      ),

    /** Map of attractionId -> day index it is scheduled on (first match). */
    plannedAttractionDays: (s): Record<string, number> => {
      const map: Record<string, number> = {}
      s.days.forEach((day, index) => {
        for (const item of day.items) {
          if (item.attractionId && !(item.attractionId in map)) {
            map[item.attractionId] = index
          }
        }
      })
      return map
    },

    parksInPlan: (s): string[] => {
      const seen = new Set<string>()
      for (const d of s.days) if (d.parkId) seen.add(d.parkId)
      return [...seen]
    },

    budgetSpent: (s): number =>
      s.budget.reduce((sum, b) => sum + (Number(b.amount) || 0), 0),

    budgetPaid: (s): number =>
      s.budget
        .filter((b) => b.paid)
        .reduce((sum, b) => sum + (Number(b.amount) || 0), 0),

    budgetRemaining(): number {
      return this.budgetTotal - this.budgetSpent
    },

    budgetByCategory: (s): Record<string, number> => {
      const out: Record<string, number> = {}
      for (const b of s.budget) {
        out[b.category] = (out[b.category] ?? 0) + (Number(b.amount) || 0)
      }
      return out
    },

    perPersonSpend(): number {
      const size = Math.max(1, this.trip.partySize)
      return this.budgetSpent / size
    },

    packingByCategory: (s): Record<string, PackingItem[]> => {
      const out: Record<string, PackingItem[]> = {}
      for (const item of s.packing) {
        ;(out[item.category] ??= []).push(item)
      }
      return out
    },

    packingProgress: (s): { done: number; total: number; pct: number } => {
      const total = s.packing.length
      const done = s.packing.filter((p) => p.done).length
      return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
    },
  },

  actions: {
    // ---- trip ----
    updateTrip(patch: Partial<TripInfo>) {
      this.trip = { ...this.trip, ...patch }
      if (patch.nights !== undefined) {
        this.setDayCount(Math.max(1, Math.round(patch.nights)))
      }
    },

    setDayCount(count: number) {
      const n = Math.min(30, Math.max(1, Math.round(count)))
      this.days = makeDays(n, this.days)
    },

    assignPark(dayIndex: number, parkId: string | null) {
      const day = this.days[dayIndex]
      if (day) day.parkId = parkId
    },

    setDayNote(dayIndex: number, note: string) {
      const day = this.days[dayIndex]
      if (day) day.note = note
    },

    // ---- itinerary items ----
    addItem(dayIndex: number, partial: Partial<ItineraryItem> & { title: string }) {
      const day = this.days[dayIndex]
      if (!day) return
      const item: ItineraryItem = {
        id: uid(),
        title: partial.title,
        type: partial.type ?? 'other',
        attractionId: partial.attractionId,
        time: partial.time,
        durationMin: partial.durationMin,
        note: partial.note,
        done: false,
      }
      day.items.push(item)
      this.sortDay(dayIndex)
      return item.id
    },

    addAttractionToDay(dayIndex: number, attractionId: string) {
      const a: Attraction | undefined = ATTRACTION_BY_ID[attractionId]
      if (!a) return
      return this.addItem(dayIndex, {
        title: a.name,
        type: a.type as AttractionType,
        attractionId: a.id,
        durationMin: a.durationMin,
      })
    },

    updateItem(dayIndex: number, itemId: string, patch: Partial<ItineraryItem>) {
      const day = this.days[dayIndex]
      const item = day?.items.find((i) => i.id === itemId)
      if (!item) return
      Object.assign(item, patch)
      if (patch.time !== undefined) this.sortDay(dayIndex)
    },

    toggleItemDone(dayIndex: number, itemId: string) {
      const item = this.days[dayIndex]?.items.find((i) => i.id === itemId)
      if (item) item.done = !item.done
    },

    removeItem(dayIndex: number, itemId: string) {
      const day = this.days[dayIndex]
      if (!day) return
      day.items = day.items.filter((i) => i.id !== itemId)
    },

    moveItemToDay(fromDay: number, itemId: string, toDay: number) {
      if (fromDay === toDay) return
      const src = this.days[fromDay]
      const dest = this.days[toDay]
      if (!src || !dest) return
      const idx = src.items.findIndex((i) => i.id === itemId)
      if (idx === -1) return
      const [item] = src.items.splice(idx, 1)
      dest.items.push(item!)
      this.sortDay(toDay)
    },

    nudgeItem(dayIndex: number, itemId: string, dir: -1 | 1) {
      const items = this.days[dayIndex]?.items
      if (!items) return
      const i = items.findIndex((x) => x.id === itemId)
      const j = i + dir
      if (i === -1 || j < 0 || j >= items.length) return
      ;[items[i], items[j]] = [items[j]!, items[i]!]
    },

    /** Keep timed items in chronological order; untimed items keep their slot. */
    sortDay(dayIndex: number) {
      const day = this.days[dayIndex]
      if (!day) return
      day.items = [...day.items]
        .map((item, order) => ({ item, order }))
        .sort((a, b) => {
          const ta = a.item.time
          const tb = b.item.time
          if (ta && tb) return ta.localeCompare(tb) || a.order - b.order
          if (ta) return -1
          if (tb) return 1
          return a.order - b.order
        })
        .map((x) => x.item)
    },

    clearDay(dayIndex: number) {
      const day = this.days[dayIndex]
      if (day) day.items = []
    },

    // ---- budget ----
    setBudgetTotal(value: number) {
      this.budgetTotal = Math.max(0, Math.round(Number(value) || 0))
    },

    addBudgetItem(partial: Omit<BudgetItem, 'id'>) {
      this.budget.push({ ...partial, id: uid() })
    },

    updateBudgetItem(id: string, patch: Partial<BudgetItem>) {
      const item = this.budget.find((b) => b.id === id)
      if (item) Object.assign(item, patch)
    },

    removeBudgetItem(id: string) {
      this.budget = this.budget.filter((b) => b.id !== id)
    },

    // ---- packing ----
    seedPacking(force = false) {
      if (this.packingSeeded && !force) return
      const existing = new Set(this.packing.map((p) => p.label.toLowerCase()))
      for (const seed of PACKING_TEMPLATE) {
        if (existing.has(seed.label.toLowerCase())) continue
        this.packing.push({
          id: uid(),
          label: seed.label,
          category: seed.category,
          done: seed.done ?? false,
        })
      }
      this.packingSeeded = true
    },

    addPackingItem(label: string, category = 'Other') {
      const clean = label.trim()
      if (!clean) return
      this.packing.push({ id: uid(), label: clean, category, done: false })
    },

    togglePacking(id: string) {
      const item = this.packing.find((p) => p.id === id)
      if (item) item.done = !item.done
    },

    removePackingItem(id: string) {
      this.packing = this.packing.filter((p) => p.id !== id)
    },

    clearCheckedPacking() {
      this.packing = this.packing.filter((p) => !p.done)
    },

    // ---- whole trip ----
    resetAll() {
      this.$reset()
    },

    loadDemo() {
      this.$reset()
      const start = new Date()
      start.setDate(start.getDate() + 30)
      this.trip = {
        name: 'Orlando with the family',
        startDate: start.toISOString().slice(0, 10),
        nights: 5,
        partySize: 4,
        homeBase: "Universal's Cabana Bay Beach Resort",
        notes: 'First-timers. One rest day mid-week. Fireworks at least once.',
      }
      this.setDayCount(5)
      const plan: Array<[string, string[]]> = [
        ['ioa', ['ioa-hagrid', 'ioa-velocicoaster', 'ioa-forbidden', 'ioa-spiderman']],
        ['usf', ['usf-escape', 'usf-bourne', 'usf-mummy', 'usf-simpsons']],
        ['other', []],
        ['mk', ['mk-sdmt', 'mk-tron', 'mk-pirates', 'mk-haunted', 'mk-fireworks']],
        ['ep', ['ep-guardians', 'ep-frozen', 'ep-ratatouille', 'ep-worldshowcase']],
      ]
      plan.forEach(([parkId, ids], i) => {
        this.assignPark(i, parkId === 'ep' ? 'epcot' : parkId)
        ids.forEach((id) => this.addAttractionToDay(i, id))
      })
      this.days[2]!.note = 'Pool morning, Disney Springs in the evening.'
      this.budgetTotal = 6500
      ;[
        ['Park tickets (4 × 5-day)', 'Tickets', 2100, null],
        ['Cabana Bay – 5 nights', 'Hotel', 1150, null],
        ['Flights', 'Flights', 1600, null],
        ['Rental car + parking', 'Car & transport', 380, null],
        ['Character breakfast', 'Food & drink', 220, 3],
        ['Butterbeer fund', 'Food & drink', 90, 0],
        ['Souvenirs allowance', 'Merchandise', 400, null],
      ].forEach(([label, category, amount, day]) => {
        this.addBudgetItem({
          label: label as string,
          category: category as BudgetItem['category'],
          amount: amount as number,
          day: day as number | null,
          paid: category === 'Flights' || category === 'Hotel',
        })
      })
      this.seedPacking()
    },
  },
})
