import { defineStore } from 'pinia'
import { PARK_BY_ID, parkName } from '~/data/parks'
import { TEMPLATES, templateParkId } from '~/data/templates'
import {
  addDays,
  diffDays,
  parseISO,
  toISO,
  todayUTC,
} from '~/composables/useDates'
import type { Day, DayItem, TripState } from '~/types/trip'

const VERSION = 1

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const DEFAULT_TRIP_NAME = 'My Trip'

function blankState(): TripState {
  return {
    version: VERSION,
    created: false,
    name: DEFAULT_TRIP_NAME,
    startDate: '',
    endDate: '',
    hotels: [],
    ticketDays: { disney: 0, universal: 0 },
    parkHopper: false,
    flights: [],
    carHire: '',
    days: [],
    selectedDay: null,
    sheetOpen: false,
    justSet: null,
  }
}

const MON_FULL = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function countResort(days: Day[], resort: string): number {
  return days.filter((d) => d.parkId && PARK_BY_ID[d.parkId]?.resort === resort)
    .length
}

interface Counter {
  label: string
  value: string
  bg: string
  border: string
  dot: string
  numInk: string
}

interface Alert {
  id: string
  tone: 'warn' | 'remind'
  title: string
  body: string
  fixDayIndex?: number
}

interface WeekView {
  label: string
  range: string
  cells: (number | null)[]
}

export const useTripStore = defineStore('orlando-trip', {
  state: (): TripState => blankState(),

  persist: {
    pick: [
      'version',
      'created',
      'name',
      'startDate',
      'endDate',
      'hotels',
      'ticketDays',
      'parkHopper',
      'flights',
      'carHire',
      'days',
    ],
    /**
     * `hotels` used to be `string[]` and `flights` used to be `{ out, back }`
     * — reshape anything persisted in those old shapes so existing trips
     * don't lose data (or crash) after the schema change.
     */
    afterHydrate(ctx) {
      const s = ctx.store as any
      if (!Array.isArray(s.flights)) {
        const old = s.flights ?? {}
        s.flights = [old.out, old.back]
          .filter((v: unknown): v is string => typeof v === 'string' && v.trim() !== '')
          .map((route: string) => ({ route, time: '' }))
      }
      if (Array.isArray(s.hotels)) {
        s.hotels = s.hotels.map((h: unknown) => (typeof h === 'string' ? { name: h } : h))
      }
    },
  },

  getters: {
    startD: (s): Date | null => (s.startDate ? parseISO(s.startDate) : null),
    endD: (s): Date | null => (s.endDate ? parseISO(s.endDate) : null),

    datesValid(): boolean {
      return Boolean(
        this.startD && this.endD && this.endD.getTime() >= this.startD.getTime(),
      )
    },

    /** Trip name for display, falling back if the user has cleared the field. */
    displayName(): string {
      return this.name.trim() || DEFAULT_TRIP_NAME
    },

    dayCount(): number {
      if (!this.startD || !this.endD) return 0
      return Math.max(0, diffDays(this.endD, this.startD) + 1)
    },

    nights(): number {
      return this.dayCount > 0 ? this.dayCount - 1 : 0
    },

    hasTrip: (s): boolean => s.created && s.days.length > 0,

    firstDate(): Date | null {
      return this.days[0] ? parseISO(this.days[0].date) : this.startD
    },
    lastDate(): Date | null {
      const last = this.days[this.days.length - 1]
      return last ? parseISO(last.date) : this.endD
    },

    rangeLabel(): string {
      const a = this.firstDate
      const b = this.lastDate
      if (!a || !b) return ''
      return `${a.getUTCDate()} ${MON_FULL[a.getUTCMonth()]} – ${b.getUTCDate()} ${MON_FULL[b.getUTCMonth()]} ${b.getUTCFullYear()}`
    },

    sleepsToGo(): number {
      const a = this.firstDate
      if (!a) return 0
      return Math.max(0, diffDays(a, todayUTC()))
    },

    disneyDays: (s): number => countResort(s.days, 'wdw'),
    universalDays: (s): number => countResort(s.days, 'uor'),
    offParkDays: (s): number => countResort(s.days, 'off'),
    unsetDays: (s): number => s.days.filter((d) => !d.parkId).length,

    counters: (s): Counter[] => {
      const tD = s.ticketDays.disney || 0
      const tU = s.ticketDays.universal || 0
      const d = countResort(s.days, 'wdw')
      const u = countResort(s.days, 'uor')
      const off = countResort(s.days, 'off')
      const unset = s.days.filter((x) => !x.parkId).length
      return [
        {
          label: 'Disney',
          value: tD ? `${d}/${tD}` : String(d),
          bg: '#eef3fc',
          border: '#dbe5f7',
          dot: '#0b3d91',
          numInk: tD && d > tD ? '#c1442f' : '#0b3d91',
        },
        {
          label: 'Universal',
          value: tU ? `${u}/${tU}` : String(u),
          bg: '#fdefec',
          border: '#f8dcd6',
          dot: '#f45d48',
          numInk: tU && u > tU ? '#c1442f' : '#5b6577',
        },
        {
          label: 'Off-park',
          value: String(off),
          bg: '#fdf3dd',
          border: '#f2e2b0',
          dot: '#e0a94a',
          numInk: '#8a6a00',
        },
        {
          label: 'Unset',
          value: String(unset),
          bg: '#f2f4f9',
          border: '#e5e9f1',
          dot: '#cdd3e0',
          numInk: '#5b6577',
        },
      ]
    },

    wrongParkItems: (s): { dayIndex: number; item: DayItem }[] => {
      const out: { dayIndex: number; item: DayItem }[] = []
      s.days.forEach((day, dayIndex) => {
        for (const item of day.items) {
          if (item.parkId && item.parkId !== day.parkId) {
            out.push({ dayIndex, item })
          }
        }
      })
      return out
    },

    diningWindow(): { date: Date; daysAway: number } | null {
      const a = this.firstDate
      if (!a) return null
      const opens = addDays(a, -60)
      const daysAway = diffDays(opens, todayUTC())
      return { date: opens, daysAway }
    },

    alerts(): Alert[] {
      const list: Alert[] = []

      for (const { dayIndex, item } of this.wrongParkItems) {
        const day = this.days[dayIndex]!
        list.push({
          id: `wrong-${dayIndex}-${item.id}`,
          tone: 'warn',
          title: 'Reservation in the wrong park',
          body: `Day ${dayIndex + 1} · ${item.title} at ${parkName(item.parkId)} — but this day is set to ${day.parkId ? parkName(day.parkId) : 'nothing'}.`,
          fixDayIndex: dayIndex,
        })
      }

      const tD = this.ticketDays.disney || 0
      const tU = this.ticketDays.universal || 0
      if (tD && this.disneyDays > tD) {
        list.push({
          id: 'over-wdw',
          tone: 'warn',
          title: 'More Disney days than ticket days',
          body: `${this.disneyDays} planned, ${tD} on your ticket.`,
        })
      }
      if (tU && this.universalDays > tU) {
        list.push({
          id: 'over-uor',
          tone: 'warn',
          title: 'More Universal days than ticket days',
          body: `${this.universalDays} planned, ${tU} on your ticket.`,
        })
      }

      const dw = this.diningWindow
      if (dw && dw.daysAway > 0) {
        list.push({
          id: 'dining-window',
          tone: 'remind',
          title: `Dining bookings open in ${dw.daysAway} days`,
          body: `60 days before arrival — that's ${dw.date.getUTCDate()} ${MON_FULL[dw.date.getUTCMonth()]} ${dw.date.getUTCFullYear()}.`,
        })
      }
      return list
    },

    /** Monday-first calendar weeks; cell = day index, or null for padding. */
    weeks(): WeekView[] {
      if (!this.days.length || !this.firstDate) return []
      const start = this.firstDate
      const pad = (start.getUTCDay() + 6) % 7

      const cells: (number | null)[] = []
      for (let i = 0; i < pad; i++) cells.push(null)
      this.days.forEach((_, i) => cells.push(i))
      while (cells.length % 7) cells.push(null)

      const weeks: WeekView[] = []
      for (let w = 0; w * 7 < cells.length; w++) {
        const slice = cells.slice(w * 7, w * 7 + 7)
        const real = slice.filter((x): x is number => x !== null)
        const a = parseISO(this.days[real[0]!]!.date)
        const b = parseISO(this.days[real[real.length - 1]!]!.date)
        weeks.push({
          label: `Week ${w + 1}`,
          range: `${a.getUTCDate()} ${MON_FULL[a.getUTCMonth()]} – ${b.getUTCDate()} ${MON_FULL[b.getUTCMonth()]}`,
          cells: slice,
        })
      }
      return weeks
    },

    selected(): Day | null {
      return this.selectedDay === null
        ? null
        : (this.days[this.selectedDay] ?? null)
    },
  },

  actions: {
    updateFields(
      patch: Partial<
        Pick<
          TripState,
          | 'name'
          | 'startDate'
          | 'endDate'
          | 'hotels'
          | 'ticketDays'
          | 'parkHopper'
          | 'flights'
          | 'carHire'
        >
      >,
    ) {
      const datesTouched =
        patch.startDate !== undefined || patch.endDate !== undefined
      Object.assign(this, patch)
      if (datesTouched && this.created && this.datesValid) {
        this.refitDays()
      }
    },

    setHotel(index: number, name: string) {
      const next = this.hotels.slice()
      next[index] = { ...next[index], name }
      this.hotels = next
    },
    /** Set (or clear, passing null) the optional date range for a stay. */
    setHotelDates(index: number, dates: { start: string; end: string } | null) {
      const current = this.hotels[index]
      if (!current) return
      const next = this.hotels.slice()
      next[index] = dates
        ? { name: current.name, startDate: dates.start, endDate: dates.end }
        : { name: current.name }
      this.hotels = next
    },
    addHotel() {
      if (this.hotels.length < 4) this.hotels = [...this.hotels, { name: '' }]
    },
    removeHotel(index: number) {
      this.hotels = this.hotels.filter((_, i) => i !== index)
    },

    setFlight(index: number, patch: Partial<{ route: string; time: string }>) {
      const next = this.flights.slice()
      next[index] = { route: '', time: '', ...next[index], ...patch }
      this.flights = next
    },
    addFlight() {
      if (this.flights.length < 6) this.flights = [...this.flights, { route: '', time: '' }]
    },
    removeFlight(index: number) {
      this.flights = this.flights.filter((_, i) => i !== index)
    },

    buildDays(pattern: string[] | null): Day[] {
      if (!this.startD || !this.datesValid) return []
      const n = this.dayCount
      const prev = new Map(this.days.map((d) => [d.date, d]))
      const days: Day[] = []
      for (let i = 0; i < n; i++) {
        const iso = toISO(addDays(this.startD, i))
        const carried = prev.get(iso)
        days.push({
          date: iso,
          parkId: carried ? carried.parkId : templateParkId(pattern, i, n),
          note: carried?.note ?? '',
          items: carried?.items ?? [],
        })
      }
      return days
    },

    applyTemplate(id: string) {
      const tpl = TEMPLATES.find((t) => t.id === id)
      if (!tpl || !this.datesValid) return
      // Fresh layout: ignore any carried days from a previous template choice.
      this.days = []
      this.days = this.buildDays(tpl.pattern)
      this.created = true
      this.selectedDay = null
      this.sheetOpen = false
      this.justSet = null
    },

    /** Re-fit the day array to the current date range, keeping days by date. */
    refitDays() {
      this.days = this.buildDays(null)
    },

    assignDay(index: number, parkId: string | null) {
      const day = this.days[index]
      if (!day) return
      day.parkId = parkId
      this.justSet = index
      this.sheetOpen = false
    },
    clearDay(index: number) {
      this.assignDay(index, null)
    },
    clearJustSet() {
      this.justSet = null
    },

    setDayNote(index: number, note: string) {
      const day = this.days[index]
      if (day) day.note = note
    },

    openSheet(index: number) {
      this.selectedDay = index
      this.sheetOpen = true
    },
    closeSheet() {
      this.sheetOpen = false
    },
    selectDay(index: number) {
      this.selectedDay = Math.max(0, Math.min(this.days.length - 1, index))
    },
    stepDay(dir: -1 | 1) {
      if (this.selectedDay === null) return
      this.selectDay(this.selectedDay + dir)
    },

    addItem(
      index: number,
      partial: Omit<DayItem, 'id'> & Partial<Pick<DayItem, 'id'>>,
    ) {
      const day = this.days[index]
      if (!day) return
      day.items.push({
        id: partial.id ?? uid(),
        title: partial.title,
        time: partial.time ?? '',
        kind: partial.kind,
        state: partial.state,
        parkId: partial.parkId ?? null,
      })
      this.sortDayItems(index)
    },
    updateItem(index: number, itemId: string, patch: Partial<DayItem>) {
      const item = this.days[index]?.items.find((i) => i.id === itemId)
      if (!item) return
      Object.assign(item, patch)
      this.sortDayItems(index)
    },
    removeItem(index: number, itemId: string) {
      const day = this.days[index]
      if (day) day.items = day.items.filter((i) => i.id !== itemId)
    },
    /** Timed items ascending, untimed items after, stable otherwise. */
    sortDayItems(index: number) {
      const day = this.days[index]
      if (!day) return
      day.items = day.items
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

    resetTrip() {
      this.$reset()
    },
  },
})
