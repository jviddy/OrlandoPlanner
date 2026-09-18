<script setup lang="ts">
/**
 * The three required fields (name + arrive/depart) plus the three optional
 * collapsible sections. Shared by the new-trip gate and the edit screen.
 * Can edit a detached draft, or write to the store during first-time setup.
 */
import { addDays, diffDays, parseISO, toISO } from '~/composables/useDates'
import { createStableId } from '~/utils/tripSchema'
import type { Flight, Stay, TripDetailsDraft } from '~/types/trip'

const props = defineProps<{ draft?: TripDetailsDraft }>()

const store = useTripStore()
const model = computed(() => props.draft ?? store)

function updateFields(patch: Partial<TripDetailsDraft>) {
  if (props.draft) Object.assign(props.draft, patch)
  else store.updateFields(patch)
}

function setHotel(index: number, name: string) {
  if (!props.draft) return store.setHotel(index, name)
  const next = props.draft.hotels.slice()
  next[index] = { id: next[index]?.id ?? createStableId('stay'), ...next[index], name }
  props.draft.hotels = next
}

function setHotelDates(index: number, dates: { start: string; end: string } | null) {
  if (!props.draft) return store.setHotelDates(index, dates)
  const current = props.draft.hotels[index]
  if (!current) return
  const next = props.draft.hotels.slice()
  next[index] = dates
    ? { id: current.id, name: current.name, startDate: dates.start, endDate: dates.end }
    : { id: current.id, name: current.name }
  props.draft.hotels = next
}

function addHotel() {
  if (!props.draft) return store.addHotel()
  if (props.draft.hotels.length < 4) {
    props.draft.hotels = [...props.draft.hotels, { id: createStableId('stay'), name: '' }]
  }
}

function setFlight(index: number, patch: Partial<Omit<Flight, 'id'>>) {
  if (!props.draft) return store.setFlight(index, patch)
  const next = props.draft.flights.slice()
  next[index] = {
    id: next[index]?.id ?? createStableId('flight'),
    route: '', date: '', departTime: '', arriveTime: '',
    ...next[index], ...patch,
  }
  props.draft.flights = next
}

function addFlight() {
  if (!props.draft) return store.addFlight()
  if (props.draft.flights.length < 6) {
    props.draft.flights = [...props.draft.flights, {
      id: createStableId('flight'), route: '', date: '', departTime: '', arriveTime: '',
    }]
  }
}

const open = reactive<Record<string, boolean>>({})
function toggle(key: string) {
  open[key] = !open[key]
}

const computedLine = computed(() =>
  datesValid.value
    ? `${dayCount.value} days · ${Math.max(0, dayCount.value - 1)} nights`
    : 'Add both dates to continue',
)

const datesValid = computed(() => Boolean(
  model.value.startDate && model.value.endDate && model.value.endDate >= model.value.startDate,
))
const dayCount = computed(() => datesValid.value
  ? diffDays(parseISO(model.value.endDate), parseISO(model.value.startDate)) + 1
  : 0)

const staySummary = computed(() => {
  if (model.value.hotels[1]?.name.trim()) return 'Split stay · 2 hotels'
  if (model.value.hotels[0]?.name.trim()) return model.value.hotels[0].name
  return 'Not set'
})

function onTripDatesUpdate({ start, end }: { start: string; end: string }) {
  updateFields({ startDate: start, endDate: end })
}
function onStayDatesUpdate(index: number, value: { start: string; end: string }) {
  setHotelDates(index, value.start ? value : null)
}

function stayNights(i: number): number {
  const h = model.value.hotels[i]
  if (!h?.startDate || !h?.endDate) return 0
  return diffDays(parseISO(h.endDate), parseISO(h.startDate))
}

/** ISO dates already covered by a *different* stay, for the "already booked" dot. */
function otherStayDates(excludeIndex: number): string[] {
  const dates: string[] = []
  model.value.hotels.forEach((h: Stay, idx: number) => {
    if (idx === excludeIndex || !h.startDate || !h.endDate) return
    for (let d = parseISO(h.startDate); toISO(d) <= h.endDate; d = addDays(d, 1)) {
      dates.push(toISO(d))
    }
  })
  return dates
}
const ticketSummary = computed(
  () =>
    `${model.value.ticketDays.disney || 0} Disney · ${model.value.ticketDays.universal || 0} Universal`,
)
const flightSummary = computed(() => {
  const set = model.value.flights.filter((f: Flight) => f.route.trim()).length
  if (!set) return 'Not set'
  return `${set} flight${set === 1 ? '' : 's'} set`
})

function flightLabel(i: number): string {
  if (i === 0) return 'Outbound'
  if (i === 1) return 'Return'
  return `Flight ${i + 1}`
}
function flightPlaceholder(i: number): string {
  if (i === 0) return 'MAN → MCO'
  if (i === 1) return 'MCO → MAN'
  return 'Airport → Airport'
}

function setTicket(key: 'disney' | 'universal', value: string) {
  const n = Math.max(0, Math.min(60, Math.round(Number(value) || 0)))
  updateFields({ ticketDays: { ...model.value.ticketDays, [key]: n } })
}
</script>

<template>
  <div class="tdf">
    <div class="tdf__required">
      <label class="field">
        <span>Trip name</span>
        <input
          class="input"
          type="text"
          placeholder="Florida 2027"
          :value="model.name"
          @input="updateFields({ name: ($event.target as HTMLInputElement).value })"
        />
      </label>
      <label class="field">
        <span>Dates</span>
        <DateRangeField
          :start="model.startDate"
          :end="model.endDate"
          placeholder="Add your dates"
          sheet-title="Trip dates"
          @update="onTripDatesUpdate"
        />
      </label>
      <p class="tdf__computed">{{ computedLine }}</p>
      <slot name="afterDates" />
    </div>

    <div class="tdf__optional">
      <p class="eyebrow">Optional — add now or later</p>

      <section class="disc">
        <button type="button" class="disc__head" @click="toggle('stay')">
          <span class="disc__tile" style="background: #e8effb; color: #0b3d91">
            <AppIcon name="bed" :size="17" />
          </span>
          <span class="disc__meta">
            <span class="disc__title">Where you're staying</span>
            <span class="disc__summary">{{ staySummary }}</span>
          </span>
          <AppIcon :name="open.stay ? 'chevronUp' : 'chevronDown'" :size="14" class="disc__chev" />
        </button>
        <div v-if="open.stay" class="disc__body">
          <div v-for="(_, i) in Math.max(1, model.hotels.length)" :key="i" class="stay">
            <label class="drow">
              <span>Hotel {{ i + 1 }}</span>
              <input
                class="input input--sm"
                type="text"
                placeholder="Hotel name"
                :value="model.hotels[i]?.name ?? ''"
                @input="setHotel(i, ($event.target as HTMLInputElement).value)"
              />
            </label>
            <div v-if="datesValid" class="stay__dates-row">
              <DateRangeField
                compact
                variant="days"
                class="stay__dates"
                :start="model.hotels[i]?.startDate ?? ''"
                :end="model.hotels[i]?.endDate ?? ''"
                :min="model.startDate"
                :max="model.endDate"
                :assigned-dates="otherStayDates(i)"
                placeholder="+ Add dates for this stay (optional)"
                sheet-title="Stay dates"
                @update="onStayDatesUpdate(i, $event)"
              />
              <span v-if="stayNights(i) > 0" class="stay__nights">
                · {{ stayNights(i) }} night{{ stayNights(i) === 1 ? '' : 's' }}
              </span>
            </div>
            <span v-else class="stay__dates-hint">Set your trip dates to add stay dates</span>
          </div>
          <button type="button" class="disc__action" @click="addHotel()">
            + Add another stay
          </button>
        </div>
      </section>

      <section class="disc">
        <button type="button" class="disc__head" @click="toggle('tix')">
          <span class="disc__tile" style="background: #fdece9; color: #c1442f">
            <AppIcon name="ticket" :size="17" />
          </span>
          <span class="disc__meta">
            <span class="disc__title">Tickets</span>
            <span class="disc__summary">{{ ticketSummary }}</span>
          </span>
          <AppIcon :name="open.tix ? 'chevronUp' : 'chevronDown'" :size="14" class="disc__chev" />
        </button>
        <div v-if="open.tix" class="disc__body">
          <label class="drow">
            <span>Disney days</span>
            <input
              class="input input--sm"
              type="number"
              min="0"
              inputmode="numeric"
              placeholder="0"
              :value="model.ticketDays.disney || ''"
              @input="setTicket('disney', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="drow">
            <span>Universal days</span>
            <input
              class="input input--sm"
              type="number"
              min="0"
              inputmode="numeric"
              placeholder="0"
              :value="model.ticketDays.universal || ''"
              @input="setTicket('universal', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="disc__check">
            <input
              type="checkbox"
              :checked="model.parkHopper"
              @change="updateFields({ parkHopper: ($event.target as HTMLInputElement).checked })"
            />
            Park hopper included
          </label>
        </div>
      </section>

      <section class="disc">
        <button type="button" class="disc__head" @click="toggle('fly')">
          <span class="disc__tile" style="background: #e6f5f3; color: #0f7d74">
            <AppIcon name="plane" :size="17" />
          </span>
          <span class="disc__meta">
            <span class="disc__title">Flights</span>
            <span class="disc__summary">{{ flightSummary }}</span>
          </span>
          <AppIcon :name="open.fly ? 'chevronUp' : 'chevronDown'" :size="14" class="disc__chev" />
        </button>
        <div v-if="open.fly" class="disc__body">
          <div v-for="(_, i) in Math.max(2, model.flights.length)" :key="i" class="flight">
            <div class="drow">
              <span>{{ flightLabel(i) }}</span>
              <input
                class="input input--sm"
                type="text"
                :placeholder="flightPlaceholder(i)"
                :value="model.flights[i]?.route ?? ''"
                @input="setFlight(i, { route: ($event.target as HTMLInputElement).value })"
              />
            </div>
            <div class="flight__times">
              <label class="field field--tiny">
                <span>Date</span>
                <input
                  class="input input--sm"
                  type="date"
                  :min="model.startDate || undefined"
                  :max="model.endDate || undefined"
                  :value="model.flights[i]?.date ?? ''"
                  @input="setFlight(i, { date: ($event.target as HTMLInputElement).value })"
                />
              </label>
              <label class="field field--tiny">
                <span>Takeoff</span>
                <input
                  class="input input--sm"
                  type="time"
                  :value="model.flights[i]?.departTime ?? ''"
                  @input="setFlight(i, { departTime: ($event.target as HTMLInputElement).value })"
                />
              </label>
              <label class="field field--tiny">
                <span>Landing</span>
                <input
                  class="input input--sm"
                  type="time"
                  :value="model.flights[i]?.arriveTime ?? ''"
                  @input="setFlight(i, { arriveTime: ($event.target as HTMLInputElement).value })"
                />
              </label>
            </div>
          </div>
          <button
            v-if="model.flights.length < 6"
            type="button"
            class="disc__action"
            @click="addFlight()"
          >
            + Add another flight
          </button>
          <label v-if="open.car || model.carHire" class="drow">
            <span>Car hire</span>
            <input
              class="input input--sm"
              type="text"
              placeholder="Pick-up → drop-off"
              :value="model.carHire"
              @input="updateFields({ carHire: ($event.target as HTMLInputElement).value })"
            />
          </label>
          <button v-else type="button" class="disc__action" @click="open.car = true">
            + Add car hire
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.tdf__required {
  padding: 16px 20px 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.tdf__computed {
  font-size: 13px;
  color: var(--text-dim);
}
.tdf__optional {
  padding: 18px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tdf__optional .eyebrow {
  margin-bottom: 2px;
}

.disc {
  border: 1.5px solid var(--warm-border);
  border-radius: var(--r-row);
  background: #fffdf6;
  overflow: hidden;
}
.disc__head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  text-align: left;
}
.disc__tile {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: grid;
  place-items: center;
}
.disc__meta {
  flex: 1;
  min-width: 0;
}
.disc__title {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}
.disc__summary {
  display: block;
  font-size: 12.5px;
  color: var(--text-faint);
  margin-top: 1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.disc__chev {
  flex: none;
  color: var(--text-faint);
}
.disc__body {
  padding: 0 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.drow {
  display: flex;
  align-items: center;
  gap: 12px;
}
.drow > span {
  flex: none;
  width: 96px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-muted);
}
.drow .input {
  flex: 1;
}
.flight {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.flight__times {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.field--tiny > span {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text-muted);
}
.field--tiny .input {
  padding: 8px 9px;
}
.stay {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stay__dates-row {
  display: flex;
  align-items: center;
  gap: 4px;
  align-self: flex-end;
  margin-right: 2px;
}
.stay__nights {
  font-size: 12px;
  color: var(--text-faint);
  white-space: nowrap;
}
.stay__dates-hint {
  align-self: flex-end;
  margin-right: 2px;
  font-size: 12.5px;
  color: var(--text-faint);
}
.disc__action {
  align-self: flex-start;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-navy);
  padding: 2px 0;
}
.disc__check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}
</style>
