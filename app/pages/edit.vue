<script setup lang="ts">
import type { WeekStart } from '~/types/trip'
import type { TripDetailsDraft } from '~/types/trip'
import { dateRangeImpact } from '~/utils/tripSchema'

useHead({ title: 'Edit trip · Orlando Planner' })

const store = useTripStore()

function copyDetails(): TripDetailsDraft {
  return {
    name: store.name,
    startDate: store.startDate,
    endDate: store.endDate,
    weekStart: store.weekStart,
    hotels: store.hotels.map((hotel) => ({ ...hotel })),
    ticketDays: { ...store.ticketDays },
    parkHopper: store.parkHopper,
    flights: store.flights.map((flight) => ({ ...flight })),
    carHire: store.carHire,
  }
}

const draft = reactive<TripDetailsDraft>(copyDetails())
const original = ref('')
const confirmDateChange = ref(false)
const impact = computed(() => dateRangeImpact(store.days, draft.startDate, draft.endDate))
const affected = computed(() => ({
  flights: store.flights.filter((flight) => flight.date && (flight.date < draft.startDate || flight.date > draft.endDate)).length,
  stays: store.hotels.filter((stay) => (stay.startDate && stay.startDate < draft.startDate) || (stay.endDate && stay.endDate > draft.endDate)).length,
  bookings: store.days.filter((day) => day.date < draft.startDate || day.date > draft.endDate).reduce((sum, day) => sum + day.items.filter((item) => item.anchor === 'date').length, 0),
}))
const dirty = computed(() => original.value !== JSON.stringify(draft))

onMounted(() => {
  if (!store.hasTrip) navigateTo('/new', { replace: true })
  Object.assign(draft, copyDetails())
  original.value = JSON.stringify(draft)
})

const weekStartOptions: { value: WeekStart; label: string }[] = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'tripDay1', label: 'Day 1 of my trip' },
]

const confirmReset = ref(false)
function reset() {
  store.resetTrip()
  navigateTo('/new', { replace: true })
}


function save() {
  if (!draft.startDate || !draft.endDate || draft.endDate < draft.startDate) return
  if (impact.value.removedWithContent > 0 && !confirmDateChange.value) {
    confirmDateChange.value = true
    return
  }
  store.updateFields({
    ...draft,
    hotels: draft.hotels.map((hotel) => ({ ...hotel })),
    ticketDays: { ...draft.ticketDays },
    flights: draft.flights.map((flight) => ({ ...flight })),
  })
  navigateTo('/')
}
</script>

<template>
  <div class="screen">
    <ClientOnly>
      <div class="scroll">
        <header class="edit__head">
          <NuxtLink to="/" class="linkback">
            <AppIcon name="arrowLeft" :size="15" /> Overview
          </NuxtLink>
          <h1>Edit trip</h1>
          <p class="edit__lede">
            Changing the dates keeps every day you've already set — days are
            matched by date.
          </p>
        </header>

        <TripDetailsFields :draft="draft" />

        <div v-if="dirty && (impact.added || impact.removed)" class="edit__impact" aria-live="polite">
          <strong>Date change preview</strong>
          <span v-if="impact.added">{{ impact.added }} day{{ impact.added === 1 ? '' : 's' }} added.</span>
          <span v-if="impact.removed">
            {{ impact.removed }} day{{ impact.removed === 1 ? '' : 's' }} moved to recovery.
          </span>
          <span v-if="impact.removedWithContent">
            {{ impact.removedWithContent }} of those contain plans.
          </span>
          <span v-if="affected.flights || affected.stays || affected.bookings">
            Review needed: {{ affected.flights }} flight{{ affected.flights === 1 ? '' : 's' }},
            {{ affected.stays }} stay{{ affected.stays === 1 ? '' : 's' }}, and
            {{ affected.bookings }} fixed booking{{ affected.bookings === 1 ? '' : 's' }} outside the new range.
          </span>
        </div>

        <div v-if="store.recovery.removedDays.length" class="edit__recovery">
          <div><strong>{{ store.recovery.removedDays.length }} recovered day{{ store.recovery.removedDays.length === 1 ? '' : 's' }}</strong><span>These restore automatically if their dates return to the trip.</span></div>
          <button type="button" @click="store.clearRecovery()">Clear archive</button>
        </div>

        <TripSyncPanel />

        <div class="edit__section">
          <p class="group-label">Week starts on</p>
          <div class="segmented">
            <button
              v-for="opt in weekStartOptions"
              :key="opt.value"
              type="button"
              class="segmented__btn"
              :class="{ 'segmented__btn--on': draft.weekStart === opt.value }"
              @click="draft.weekStart = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="edit__danger">
          <hr />
          <template v-if="!confirmReset">
            <button type="button" class="edit__reset" @click="confirmReset = true">
              Start a fresh trip
            </button>
            <p class="edit__note">Clears this trip and its day grid.</p>
          </template>
          <div v-else class="edit__confirm">
            <span>Delete this trip and start over?</span>
            <div class="edit__confirm-row">
              <button type="button" class="edit__btn" @click="confirmReset = false">
                Keep it
              </button>
              <button type="button" class="edit__btn edit__btn--del" @click="reset">
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="edit__foot">
        <NuxtLink to="/" class="edit__cancel">Cancel</NuxtLink>
        <button class="cta" :disabled="!dirty || !draft.startDate || draft.endDate < draft.startDate" @click="save">
          Save changes
        </button>
      </div>

      <div v-if="confirmDateChange" class="edit__veil" @click.self="confirmDateChange = false">
        <section class="edit__dialog" role="dialog" aria-modal="true" aria-labelledby="date-change-title">
          <h2 id="date-change-title">Keep plans from removed dates?</h2>
          <p>
            {{ impact.removedWithContent }} planned day{{ impact.removedWithContent === 1 ? '' : 's' }} will leave the calendar.
            They will stay available in recovery if you extend the dates again.
          </p>
          <div class="edit__dialog-actions">
            <button type="button" class="edit__btn" @click="confirmDateChange = false">Review dates</button>
            <button type="button" class="cta" @click="save">Save and recover later</button>
          </div>
        </section>
      </div>

      <template #fallback>
        <div class="scroll" style="background: var(--paper)" />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.edit__head {
  padding: 18px 20px 4px;
}
.edit__head .linkback {
  margin-bottom: 14px;
}
.edit__head h1 {
  font-size: 27px;
  margin: 0 0 6px;
}
.edit__lede {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-muted);
}
.edit__section {
  padding: 4px 20px 20px;
}
.edit__impact {
  margin: 0 20px 18px;
  padding: 12px 14px;
  border: 1px solid #dfc98f;
  border-radius: var(--r-row);
  background: #fff8df;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.45;
}
.edit__impact strong,
.edit__impact span { display: block; }
.edit__recovery { margin:0 20px 18px; padding:12px 14px; display:flex; justify-content:space-between; gap:12px; border:1px solid var(--warm-border); border-radius:var(--r-row); }
.edit__recovery strong,.edit__recovery span { display:block; }
.edit__recovery span { margin-top:2px; color:var(--text-faint); font-size:12px; }
.edit__recovery button { flex:none; color:var(--warn-ink); font-size:12px; font-weight:700; }
.segmented {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}
.segmented__btn {
  flex: 1;
  padding: 10px 6px;
  border-radius: var(--r-sheet-tile);
  background: #f2f4f9;
  color: var(--text-muted);
  font-size: 12.5px;
  font-weight: 600;
  text-align: center;
  border: 1.5px solid transparent;
}
.segmented__btn--on {
  background: var(--tile-selected);
  color: var(--c-navy);
  border-color: var(--c-navy);
}
.edit__danger {
  padding: 4px 20px 28px;
}
.edit__danger hr {
  border: 0;
  border-top: 1px solid var(--warm-border);
  margin-bottom: 16px;
}
.edit__reset {
  font-size: 14px;
  font-weight: 700;
  color: var(--warn-ink);
}
.edit__note {
  font-size: 12.5px;
  color: var(--text-faint);
  margin-top: 3px;
}
.edit__confirm span {
  font-size: 14px;
  font-weight: 600;
}
.edit__confirm-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.edit__btn {
  padding: 9px 16px;
  border-radius: var(--r-sheet-tile);
  font-size: 13px;
  font-weight: 600;
  background: #f2f4f9;
  color: var(--text-muted);
}
.edit__btn--del {
  background: var(--warn-ink);
  color: #fff;
}
.edit__foot {
  flex: none;
  padding: 12px 20px max(26px, env(safe-area-inset-bottom));
  background: var(--paper);
  border-top: 1px solid var(--warm-rule);
  display: flex;
  align-items: center;
  gap: 14px;
}
.edit__foot .cta { flex: 1; }
.edit__cancel {
  color: var(--text-muted);
  font-weight: 700;
  font-size: 14px;
}
.edit__veil {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(9, 26, 51, 0.42);
}
.edit__dialog {
  width: min(430px, 100%);
  padding: 22px;
  border-radius: var(--r-card);
  background: var(--paper);
  box-shadow: 0 18px 50px rgba(9, 26, 51, 0.24);
}
.edit__dialog h2 { margin: 0 0 8px; font-size: 21px; }
.edit__dialog p { color: var(--text-muted); font-size: 14px; line-height: 1.5; }
.edit__dialog-actions { display: flex; gap: 10px; margin-top: 18px; }
.edit__dialog-actions .cta { flex: 1; }
</style>
