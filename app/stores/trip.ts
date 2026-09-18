import { defineStore } from 'pinia'
import {
  RESORTS,
  parkName,
  resolvePark,
  type CustomActivity,
  type ResortKey,
} from '~/data/parks'
import { TEMPLATES, templateParkId } from '~/data/templates'
import {
  addDays,
  diffDays,
  parseISO,
  toISO,
  todayUTC,
} from '~/composables/useDates'
import type { Day, DayItem, TripState } from '~/types/trip'
import {
  createStableId,
  migratePersistedTrip,
  refitDaysWithRecovery,
  TRIP_SCHEMA_VERSION,
} from '~/utils/tripSchema'

const VERSION = TRIP_SCHEMA_VERSION

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
    tripId: createStableId('trip'),
    created: false,
    name: DEFAULT_TRIP_NAME,
    startDate: '',
    endDate: '',
    weekStart: 'monday',
    hotels: [],
    ticketDays: { disney: 0, universal: 0 },
    parkHopper: false,
    flights: [],
    carHire: '',
    days: [],
    customActivities: [],
    recovery: { removedDays: [], updatedAt: '' },
    selectedDay: null,
    sheetOpen: false,
    justSet: null,
    undo: null,
    recentActivityIds: [],
  }
}

const MON_FULL = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function countResort(days: Day[], resort: ResortKey, custom: CustomActivity[]): number {
  return days.filter(
    (d) =>
      resolvePark(d.parkId, custom)?.resort === resort ||
      resolvePark(d.secondParkId, custom)?.resort === resort,
  ).length
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
      'tripId',
      'created',
      'name',
      'startDate',
      'endDate',
      'weekStart',
      'hotels',
      'ticketDays',
      'parkHopper',
      'flights',
      'carHire',
      'days',
      'customActivities',
      'recovery',
    ],
    /**
     * `hotels` used to be `string[]`, and `flights` has gone through two
     * shapes (`{ out, back }`, then `{ route, time }`) — reshape anything
     * persisted in an old shape so existing trips don't lose data (or crash)
     * after a schema change.
     */
    afterHydrate(ctx) {
      Object.assign(ctx.store, migratePersistedTrip(ctx.store))
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

    disneyDays: (s): number => countResort(s.days, 'disney', s.customActivities),
    universalDays: (s): number => countResort(s.days, 'universal', s.customActivities),
    offParkDays: (s): number => countResort(s.days, 'off', s.customActivities),
    unsetDays: (s): number => s.days.filter((d) => !d.parkId).length,

    /**
     * Named hotel(s) covering the night of a given ISO date. If no stay has
     * explicit dates, a single named stay is assumed to cover the whole
     * trip (matching how a stay behaves before you set its own dates).
     */
    hotelsForDate(): (iso: string) => string[] {
      const named = this.hotels.filter((h) => h.name.trim())
      const withDates = named.filter((h) => h.startDate && h.endDate)
      if (withDates.length) {
        return (iso: string) =>
          withDates
            .filter((h) => iso >= h.startDate! && iso < h.endDate!)
            .map((h) => h.name.trim())
      }
      const whole = named.length === 1 ? [named[0]!.name.trim()] : []
      return () => whole
    },

    counters: (s): Counter[] => {
      const tD = s.ticketDays.disney || 0
      const tU = s.ticketDays.universal || 0
      const d = countResort(s.days, 'disney', s.customActivities)
      const u = countResort(s.days, 'universal', s.customActivities)
      const off = countResort(s.days, 'off', s.customActivities)
      const unset = s.days.filter((x) => !x.parkId).length
      return [
        {
          label: 'Disney',
          value: tD ? `${d}/${tD}` : String(d),
          bg: '#eef3fc',
          border: '#dbe5f7',
          dot: RESORTS.disney.dot,
          numInk: tD && d > tD ? '#c1442f' : RESORTS.disney.dot,
        },
        {
          label: 'Universal',
          value: tU ? `${u}/${tU}` : String(u),
          bg: '#fdefec',
          border: '#f8dcd6',
          dot: RESORTS.universal.dot,
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
          if (item.parkId && item.parkId !== day.parkId && item.parkId !== day.secondParkId) {
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
          body: `Day ${dayIndex + 1} · ${item.title} at ${parkName(item.parkId, this.customActivities)} — but this day is set to ${
            day.parkId
              ? [day.parkId, day.secondParkId]
                  .filter((id): id is string => Boolean(id))
                  .map((id) => parkName(id, this.customActivities))
                  .join(' + ')
              : 'nothing'
          }.`,
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
      const pad =
        this.weekStart === 'tripDay1'
          ? 0
          : this.weekStart === 'sunday'
            ? start.getUTCDay()
            : (start.getUTCDay() + 6) % 7

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
    dayIndexById: (s) => (id: string): number => s.days.findIndex((day) => day.id === id),
  },

  actions: {
    updateFields(
      patch: Partial<
        Pick<
          TripState,
          | 'name'
          | 'startDate'
          | 'endDate'
          | 'weekStart'
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
      next[index] = { id: next[index]?.id ?? createStableId('stay'), ...next[index], name }
      this.hotels = next
    },
    /** Set (or clear, passing null) the optional date range for a stay. */
    setHotelDates(index: number, dates: { start: string; end: string } | null) {
      const current = this.hotels[index]
      if (!current) return
      const next = this.hotels.slice()
      next[index] = dates
        ? { id: current.id, name: current.name, startDate: dates.start, endDate: dates.end }
        : { id: current.id, name: current.name }
      this.hotels = next
    },
    addHotel() {
      if (this.hotels.length < 4) {
        this.hotels = [...this.hotels, { id: createStableId('stay'), name: '' }]
      }
    },
    removeHotel(index: number) {
      this.hotels = this.hotels.filter((_, i) => i !== index)
    },

    setFlight(
      index: number,
      patch: Partial<{ route: string; date: string; departTime: string; arriveTime: string }>,
    ) {
      const next = this.flights.slice()
      next[index] = {
        id: next[index]?.id ?? createStableId('flight'),
        route: '',
        date: '',
        departTime: '',
        arriveTime: '',
        ...next[index],
        ...patch,
      }
      this.flights = next
    },
    addFlight() {
      if (this.flights.length < 6) {
        this.flights = [
          ...this.flights,
          { id: createStableId('flight'), route: '', date: '', departTime: '', arriveTime: '' },
        ]
      }
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
          id: carried?.id ?? createStableId('day'),
          date: iso,
          parkId: carried ? carried.parkId : templateParkId(pattern, i, n),
          secondParkId: carried?.secondParkId ?? null,
          note: carried?.note ?? '',
          items: carried?.items ?? [],
        })
      }
      return days
    },

    applyTemplate(id: string, strategy: 'fill-unset' | 'replace-movable' = 'fill-unset') {
      const tpl = TEMPLATES.find((t) => t.id === id)
      if (!tpl || !this.datesValid) return
      if (!this.created || !this.days.length) {
        this.days = []
        this.days = this.buildDays(tpl.pattern)
      } else {
        this.days = this.days.map((day, index) => {
          const suggested = templateParkId(tpl.pattern, index, this.days.length)
          if (strategy === 'fill-unset') {
            return day.parkId || day.secondParkId ? day : { ...day, parkId: suggested }
          }
          return {
            ...day,
            parkId: suggested,
            secondParkId: null,
            note: '',
            items: day.items.filter((item) => item.anchor === 'date'),
          }
        })
      }
      this.created = true
      this.selectedDay = null
      this.sheetOpen = false
      this.justSet = null
    },

    /** Re-fit the day array to the current date range, keeping days by date. */
    refitDays() {
      const result = refitDaysWithRecovery(
        this.days,
        this.recovery.removedDays,
        this.startDate,
        this.endDate,
      )
      this.days = result.days
      this.recovery = {
        removedDays: result.removedDays,
        updatedAt: result.archiveChanged ? new Date().toISOString() : this.recovery.updatedAt,
      }
    },

    /** Update a day's activities without changing the quick-assign sheet state. */
    setDayActivities(index: number, parkId: string | null, secondParkId: string | null = null) {
      const day = this.days[index]
      if (!day) return
      const nextSecond = parkId ? secondParkId : null
      if (day.parkId === parkId && day.secondParkId === nextSecond) return
      this.undo = {
        label: `Changed day ${index + 1}`,
        days: [{ dayId: day.id, parkId: day.parkId, secondParkId: day.secondParkId }],
      }
      day.parkId = parkId
      day.secondParkId = nextSecond
      const chosen = [parkId, nextSecond].filter((id): id is string => Boolean(id))
      this.recentActivityIds = [
        ...chosen,
        ...this.recentActivityIds.filter((id) => !chosen.includes(id)),
      ].slice(0, 6)
      this.justSet = index
    },
    /** Copy the movable plan while leaving date-fixed bookings on their original dates. */
    copyDayPlan(sourceIndex: number, targetIndex: number) {
      this.copyDayPlanToMany(sourceIndex, [targetIndex])
      if (this.undo) this.undo.label = `Copied plan to day ${targetIndex + 1}`
    },
    /** Apply one movable plan to several days as a single reversible action. */
    copyDayPlanToMany(sourceIndex: number, targetIndexes: number[]) {
      const source = this.days[sourceIndex]
      if (!source) return
      const sourceIdeas = source.items.filter((item) => item.anchor === 'plan')
      const comparableItems = (items: DayItem[]) => items.map(({ id: _id, ...item }) => item)
      const targets = [...new Set(targetIndexes)]
        .filter((index) => index !== sourceIndex)
        .map((index) => ({ index, day: this.days[index] }))
        .filter((entry): entry is { index: number; day: Day } => Boolean(entry.day))
        .filter(({ day }) => {
          const targetIdeas = day.items.filter((item) => item.anchor === 'plan')
          return source.parkId !== day.parkId
            || source.secondParkId !== day.secondParkId
            || source.note !== day.note
            || JSON.stringify(comparableItems(sourceIdeas)) !== JSON.stringify(comparableItems(targetIdeas))
        })
      if (!targets.length) return
      this.undo = {
        label: `Filled ${targets.length} ${targets.length === 1 ? 'day' : 'days'}`,
        days: targets.map(({ day }) => ({
          dayId: day.id,
          parkId: day.parkId,
          secondParkId: day.secondParkId,
          note: day.note,
          items: day.items.map((item) => ({ ...item })),
        })),
      }
      for (const { index, day } of targets) {
        day.parkId = source.parkId
        day.secondParkId = source.parkId ? source.secondParkId : null
        day.note = source.note
        day.items = [
          ...day.items.filter((item) => item.anchor === 'date'),
          ...sourceIdeas.map((item) => ({ ...item, id: uid() })),
        ]
        this.sortDayItems(index)
      }
      this.justSet = targets.at(-1)!.index
    },
    /** `secondParkId` is only kept when a primary park is also set (a park-hopper day). */
    assignDay(index: number, parkId: string | null, secondParkId: string | null = null) {
      this.setDayActivities(index, parkId, secondParkId)
      this.sheetOpen = false
    },
    clearDay(index: number) {
      this.assignDay(index, null)
    },
    clearJustSet() {
      this.justSet = null
    },

    /** Adds a user-defined off-park option and returns its id. */
    addCustomActivity(label: string, glyph: string): string {
      const id = `custom-${uid()}`
      this.customActivities = [
        ...this.customActivities,
        { id, resort: 'off', name: label, short: label, glyph },
      ]
      return id
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
    selectDayById(id: string) {
      const index = this.days.findIndex((day) => day.id === id)
      if (index >= 0) this.selectedDay = index
    },
    stepDay(dir: -1 | 1) {
      if (this.selectedDay === null) return
      this.selectDay(this.selectedDay + dir)
    },

    addItem(
      index: number,
      partial: Omit<DayItem, 'id' | 'anchor'> & Partial<Pick<DayItem, 'id' | 'anchor'>>,
    ) {
      const day = this.days[index]
      if (!day) return
      day.items.push({
        id: partial.id ?? uid(),
        title: partial.title,
        time: partial.time ?? '',
        kind: partial.kind,
        state: partial.state,
        anchor: partial.anchor ?? (partial.kind === 'fixed' || partial.state === 'booked' ? 'date' : 'plan'),
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
    clearRecovery() {
      this.recovery = { removedDays: [], updatedAt: '' }
    },
    undoLastChange() {
      const entry = this.undo
      if (!entry) return
      for (const previous of entry.days) {
        const index = this.days.findIndex((day) => day.id === previous.dayId)
        const day = this.days[index]
        if (!day) continue
        day.parkId = previous.parkId
        day.secondParkId = previous.secondParkId
        if (previous.note !== undefined) day.note = previous.note
        if (previous.items !== undefined) day.items = previous.items.map((item) => ({ ...item }))
        this.justSet = index
      }
      this.undo = null
    },
    clearUndo() {
      this.undo = null
    },
  },
})
