<script setup lang="ts">
import { PARKS, PARK_BY_ID } from '~/data/parks'
import type { ItineraryItem, PlannerDay } from '~/types/trip'

const props = defineProps<{
  day: PlannerDay
  index: number
  date: Date | null
  dayCount: number
}>()

const store = useTripStore()
const { shortDate, duration } = useFormat()

const park = computed(() =>
  props.day.parkId ? PARK_BY_ID[props.day.parkId] ?? null : null,
)
const plannedMins = computed(() =>
  props.day.items.reduce((s, i) => s + (i.durationMin ?? 0), 0),
)
const doneCount = computed(() => props.day.items.filter((i) => i.done).length)

const groupedParks = computed(() => {
  const groups: Record<string, typeof PARKS> = {}
  for (const p of PARKS) (groups[p.resort] ??= []).push(p)
  return groups
})

const newTitle = ref('')
const newType = ref<ItineraryItem['type']>('other')
const newTime = ref('')

const quickTypes: { value: ItineraryItem['type']; label: string }[] = [
  { value: 'other', label: 'Plan' },
  { value: 'ride', label: 'Ride' },
  { value: 'show', label: 'Show' },
  { value: 'dining', label: 'Food' },
  { value: 'break', label: 'Break' },
  { value: 'travel', label: 'Travel' },
]

function addPlan() {
  const title = newTitle.value.trim()
  if (!title) return
  store.addItem(props.index, {
    title,
    type: newType.value,
    time: newTime.value || undefined,
  })
  newTitle.value = ''
  newTime.value = ''
}
</script>

<template>
  <section
    class="daycard card"
    :style="{ '--day-accent': park?.color ?? 'var(--border-strong)' }"
  >
    <header class="daycard__head">
      <div class="daycard__id">
        <span class="daycard__num">Day {{ index + 1 }}</span>
        <span class="daycard__date muted">
          <AppIcon name="calendar" :size="13" /> {{ shortDate(date) }}
        </span>
      </div>
      <label class="daycard__park">
        <span class="sr-only">Park for day {{ index + 1 }}</span>
        <select
          class="select"
          :value="day.parkId ?? ''"
          @change="
            store.assignPark(
              index,
              ($event.target as HTMLSelectElement).value || null,
            )
          "
        >
          <option value="">— Choose a park —</option>
          <optgroup
            v-for="(list, resort) in groupedParks"
            :key="resort"
            :label="resort"
          >
            <option v-for="p in list" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </optgroup>
        </select>
      </label>
    </header>

    <p v-if="park" class="daycard__blurb muted">{{ park.blurb }}</p>

    <div class="daycard__stats">
      <span class="chip">
        <AppIcon name="list" :size="12" /> {{ day.items.length }} planned
      </span>
      <span v-if="doneCount" class="chip">
        <AppIcon name="check" :size="12" /> {{ doneCount }} done
      </span>
      <span v-if="plannedMins" class="chip">
        <AppIcon name="clock" :size="12" /> ~{{ duration(plannedMins) }} on rides
      </span>
      <button
        v-if="day.items.length"
        type="button"
        class="btn btn-ghost btn-sm daycard__clear"
        @click="store.clearDay(index)"
      >
        Clear day
      </button>
    </div>

    <ul v-if="day.items.length" role="list" class="daycard__items">
      <ItineraryRow
        v-for="(item, i) in day.items"
        :key="item.id"
        :item="item"
        :day-index="index"
        :day-count="dayCount"
        :is-first="i === 0"
        :is-last="i === day.items.length - 1"
      />
    </ul>
    <p v-else class="daycard__empty muted">
      Nothing planned yet. Add attractions from the
      <NuxtLink to="/attractions" class="link">Attractions</NuxtLink> tab, or a
      quick plan below.
    </p>

    <form class="daycard__add" @submit.prevent="addPlan">
      <input
        v-model="newTitle"
        class="input"
        type="text"
        placeholder="Add a plan — e.g. Lunch at Satu'li Canteen"
        aria-label="New plan title"
      />
      <select v-model="newType" class="select" aria-label="Plan type">
        <option v-for="t in quickTypes" :key="t.value" :value="t.value">
          {{ t.label }}
        </option>
      </select>
      <input
        v-model="newTime"
        class="input daycard__time"
        type="time"
        aria-label="Plan time"
      />
      <button type="submit" class="btn btn-primary" :disabled="!newTitle.trim()">
        <AppIcon name="plus" :size="15" /> Add
      </button>
    </form>

    <label class="daycard__note field">
      <span>Day note</span>
      <textarea
        class="textarea"
        rows="2"
        :value="day.note"
        placeholder="Rope-drop plan, dining reservations, backup park…"
        @change="
          store.setDayNote(index, ($event.target as HTMLTextAreaElement).value)
        "
      />
    </label>
  </section>
</template>

<style scoped>
.daycard {
  padding: 18px;
  display: grid;
  gap: 12px;
  border-top: 3px solid var(--day-accent);
}
.daycard__head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}
.daycard__id {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.daycard__num {
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 680;
}
.daycard__date {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
}
.daycard__park .select {
  min-width: 210px;
}
.daycard__blurb {
  font-size: 0.86rem;
  margin-top: -4px;
}
.daycard__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.daycard__clear {
  margin-left: auto;
  color: var(--text-muted);
}
.daycard__items {
  margin: 0;
}
.daycard__empty {
  font-size: 0.88rem;
  padding: 4px 0;
}
.link {
  color: var(--accent);
  font-weight: 600;
  text-decoration: underline;
}
.daycard__add {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 8px;
}
.daycard__time {
  width: 120px;
}
.daycard__note {
  margin-top: 2px;
}
@media (max-width: 620px) {
  .daycard__add {
    grid-template-columns: 1fr 1fr;
  }
  .daycard__add .input:first-child {
    grid-column: 1 / -1;
  }
  .daycard__time {
    width: 100%;
  }
}
</style>
