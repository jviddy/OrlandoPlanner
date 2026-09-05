<script setup lang="ts">
/**
 * The three required fields (name + arrive/depart) plus the three optional
 * collapsible sections. Shared by the new-trip gate and the edit screen.
 * Writes straight to the store as you type.
 */
const store = useTripStore()

const open = reactive<Record<string, boolean>>({})
function toggle(key: string) {
  open[key] = !open[key]
}

const computedLine = computed(() =>
  store.datesValid
    ? `${store.dayCount} days · ${store.nights} nights`
    : 'Add both dates to continue',
)

const staySummary = computed(() => {
  if (store.hotels[1]?.name.trim()) return 'Split stay · 2 hotels'
  if (store.hotels[0]?.name.trim()) return store.hotels[0].name
  return 'Not set'
})

function onTripDatesUpdate({ start, end }: { start: string; end: string }) {
  store.updateFields({ startDate: start, endDate: end })
}
function onStayDatesUpdate(index: number, value: { start: string; end: string }) {
  store.setHotelDates(index, value.start ? value : null)
}
const ticketSummary = computed(
  () =>
    `${store.ticketDays.disney || 0} Disney · ${store.ticketDays.universal || 0} Universal`,
)
const flightSummary = computed(() =>
  store.flights.out.trim() || store.flights.back.trim()
    ? 'Outbound + return set'
    : 'Not set',
)

function setTicket(key: 'disney' | 'universal', value: string) {
  const n = Math.max(0, Math.min(60, Math.round(Number(value) || 0)))
  store.updateFields({ ticketDays: { ...store.ticketDays, [key]: n } })
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
          :value="store.name"
          @input="store.updateFields({ name: ($event.target as HTMLInputElement).value })"
        />
      </label>
      <label class="field">
        <span>Dates</span>
        <DateRangeField
          :start="store.startDate"
          :end="store.endDate"
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
          <div v-for="(_, i) in Math.max(1, store.hotels.length)" :key="i" class="stay">
            <label class="drow">
              <span>Hotel {{ i + 1 }}</span>
              <input
                class="input input--sm"
                type="text"
                placeholder="Hotel name"
                :value="store.hotels[i]?.name ?? ''"
                @input="store.setHotel(i, ($event.target as HTMLInputElement).value)"
              />
            </label>
            <DateRangeField
              v-if="store.datesValid"
              compact
              variant="days"
              class="stay__dates"
              :start="store.hotels[i]?.startDate ?? ''"
              :end="store.hotels[i]?.endDate ?? ''"
              :min="store.startDate"
              :max="store.endDate"
              placeholder="+ Add dates for this stay (optional)"
              sheet-title="Stay dates"
              @update="onStayDatesUpdate(i, $event)"
            />
            <span v-else class="stay__dates-hint">Set your trip dates to add stay dates</span>
          </div>
          <button type="button" class="disc__action" @click="store.addHotel()">
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
              :value="store.ticketDays.disney || ''"
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
              :value="store.ticketDays.universal || ''"
              @input="setTicket('universal', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="disc__check">
            <input
              type="checkbox"
              :checked="store.parkHopper"
              @change="store.updateFields({ parkHopper: ($event.target as HTMLInputElement).checked })"
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
          <label class="drow">
            <span>Out</span>
            <input
              class="input input--sm"
              type="text"
              placeholder="MAN → MCO"
              :value="store.flights.out"
              @input="store.updateFields({ flights: { ...store.flights, out: ($event.target as HTMLInputElement).value } })"
            />
          </label>
          <label class="drow">
            <span>Back</span>
            <input
              class="input input--sm"
              type="text"
              placeholder="MCO → MAN"
              :value="store.flights.back"
              @input="store.updateFields({ flights: { ...store.flights, back: ($event.target as HTMLInputElement).value } })"
            />
          </label>
          <label v-if="open.car || store.carHire" class="drow">
            <span>Car hire</span>
            <input
              class="input input--sm"
              type="text"
              placeholder="Pick-up → drop-off"
              :value="store.carHire"
              @input="store.updateFields({ carHire: ($event.target as HTMLInputElement).value })"
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
.stay {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stay__dates {
  align-self: flex-end;
  margin-right: 2px;
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
