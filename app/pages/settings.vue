<script setup lang="ts">
import type { TripState } from '~/types/trip'

useHead({ title: 'Settings · Orlando Trip Planner' })

const store = useTripStore()
const { fullDate } = useFormat()

const confirmReset = ref(false)
const importError = ref('')
const importOk = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function exportTrip() {
  const data = JSON.stringify(store.$state, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const slug =
    store.trip.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') ||
    'orlando-trip'
  a.download = `${slug}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function onImport(e: Event) {
  importError.value = ''
  importOk.value = false
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const parsed = JSON.parse(await file.text()) as Partial<TripState>
    if (!parsed || typeof parsed !== 'object' || !parsed.trip || !Array.isArray(parsed.days)) {
      throw new Error('That file does not look like an Orlando Planner export.')
    }
    store.$patch(parsed as TripState)
    store.setDayCount(store.days.length)
    importOk.value = true
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'Could not read that file.'
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}

function doReset() {
  store.resetAll()
  confirmReset.value = false
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Settings</h1>
        <p>Trip details drive the countdown, the dated itinerary and the budget split.</p>
      </div>
    </div>

    <ClientOnly>
      <section class="card card-pad">
        <div class="section-title">
          <AppIcon name="calendar" :size="18" />
          <h2>Trip details</h2>
        </div>

        <div class="form">
          <label class="field form__wide">
            <span>Trip name</span>
            <input
              class="input"
              :value="store.trip.name"
              @change="store.updateTrip({ name: ($event.target as HTMLInputElement).value })"
            />
          </label>

          <label class="field">
            <span>First park day</span>
            <input
              class="input"
              type="date"
              :value="store.trip.startDate"
              @change="store.updateTrip({ startDate: ($event.target as HTMLInputElement).value })"
            />
          </label>

          <label class="field">
            <span>Number of days</span>
            <input
              class="input"
              type="number"
              min="1"
              max="30"
              :value="store.trip.nights"
              @change="store.updateTrip({ nights: Number(($event.target as HTMLInputElement).value) })"
            />
          </label>

          <label class="field">
            <span>Party size</span>
            <input
              class="input"
              type="number"
              min="1"
              max="20"
              :value="store.trip.partySize"
              @change="store.updateTrip({ partySize: Math.max(1, Number(($event.target as HTMLInputElement).value) || 1) })"
            />
          </label>

          <label class="field form__wide">
            <span>Home base (hotel / resort)</span>
            <input
              class="input"
              :value="store.trip.homeBase"
              placeholder="e.g. Disney's Art of Animation Resort"
              @change="store.updateTrip({ homeBase: ($event.target as HTMLInputElement).value })"
            />
          </label>

          <label class="field form__wide">
            <span>Trip notes</span>
            <textarea
              class="textarea"
              rows="3"
              :value="store.trip.notes"
              placeholder="Flight numbers, who's coming, non-negotiables…"
              @change="store.updateTrip({ notes: ($event.target as HTMLTextAreaElement).value })"
            />
          </label>
        </div>

        <p class="form__hint muted">
          <AppIcon name="info" :size="13" />
          <span v-if="store.trip.startDate">
            Runs {{ fullDate(store.schedule[0]?.date ?? null) }} to
            {{ fullDate(store.endDate) }}. Changing the number of days keeps every
            day you've already planned.
          </span>
          <span v-else>Add a start date to switch on dated days and the countdown.</span>
        </p>
      </section>

      <section class="card card-pad data">
        <div class="section-title">
          <AppIcon name="download" :size="18" />
          <h2>Your data</h2>
        </div>
        <p class="muted data__intro">
          Everything lives in this browser's local storage — nothing is sent
          anywhere. Export a backup before switching devices.
        </p>

        <div class="data__actions">
          <button type="button" class="btn" @click="exportTrip">
            <AppIcon name="download" :size="15" /> Export as JSON
          </button>

          <label class="btn data__import">
            <AppIcon name="arrowUp" :size="15" /> Import JSON
            <input
              ref="fileInput"
              class="sr-only"
              type="file"
              accept="application/json,.json"
              @change="onImport"
            />
          </label>

          <button type="button" class="btn" @click="store.loadDemo()">
            <AppIcon name="sparkles" :size="15" /> Load demo trip
          </button>
        </div>

        <p v-if="importOk" class="data__msg data__msg--ok">
          <AppIcon name="check" :size="14" /> Trip imported.
        </p>
        <p v-if="importError" class="data__msg data__msg--err">
          <AppIcon name="info" :size="14" /> {{ importError }}
        </p>

        <hr class="divider data__rule" />

        <div class="data__danger">
          <div>
            <strong>Reset everything</strong>
            <p class="muted">Clears the trip, itinerary, budget and packing list.</p>
          </div>
          <div v-if="!confirmReset">
            <button type="button" class="btn btn-danger" @click="confirmReset = true">
              <AppIcon name="trash" :size="15" /> Reset
            </button>
          </div>
          <div v-else class="data__confirm">
            <span>Sure?</span>
            <button type="button" class="btn btn-danger btn-sm" @click="doReset">
              Yes, wipe it
            </button>
            <button type="button" class="btn btn-sm btn-ghost" @click="confirmReset = false">
              Cancel
            </button>
          </div>
        </div>
      </section>

      <template #fallback>
        <div class="card sk" />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
}
.form__wide {
  grid-column: 1 / -1;
}
.form__hint {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font-size: 0.84rem;
  margin-top: 14px;
}
.form__hint svg {
  flex: none;
  margin-top: 3px;
}

.data {
  margin-top: 18px;
}
.data__intro {
  font-size: 0.88rem;
  margin-bottom: 14px;
  max-width: 62ch;
}
.data__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.data__import {
  cursor: pointer;
}
.data__msg {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.86rem;
  font-weight: 600;
  margin-top: 10px;
}
.data__msg--ok {
  color: var(--success);
}
.data__msg--err {
  color: var(--danger);
}
.data__rule {
  margin: 18px 0;
}
.data__danger {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}
.data__danger p {
  font-size: 0.85rem;
}
.data__confirm {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.9rem;
}
.sk {
  min-height: 300px;
}
</style>
