<script setup lang="ts">
import {
  ATTRACTIONS,
  INTENSITY_LABEL,
  TYPE_LABEL,
  type AttractionType,
  type Intensity,
} from '~/data/attractions'
import { PARKS } from '~/data/parks'

useHead({ title: 'Attractions · Orlando Trip Planner' })

const store = useTripStore()

const search = ref('')
const parkFilter = ref<string>('all')
const typeFilter = ref<AttractionType | 'all'>('all')
const intensityFilter = ref<Intensity | 'all'>('all')
const hidePlanned = ref(false)
const sortBy = ref<'priority' | 'name' | 'duration'>('priority')

const types = Object.keys(TYPE_LABEL) as AttractionType[]
const intensities = Object.keys(INTENSITY_LABEL) as Intensity[]

const dayOptions = computed(() =>
  store.schedule.map((entry) => {
    const parkShort = entry.day.parkId
      ? (PARKS.find((p) => p.id === entry.day.parkId)?.short ?? '')
      : ''
    return {
      index: entry.index,
      label: `Day ${entry.index + 1}${parkShort ? ` · ${parkShort}` : ''}`,
    }
  }),
)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const planned = store.plannedAttractionDays
  let list = ATTRACTIONS.filter((a) => {
    if (parkFilter.value !== 'all' && a.parkId !== parkFilter.value) return false
    if (typeFilter.value !== 'all' && a.type !== typeFilter.value) return false
    if (intensityFilter.value !== 'all' && a.intensity !== intensityFilter.value)
      return false
    if (hidePlanned.value && a.id in planned) return false
    if (q) {
      const hay = `${a.name} ${a.land} ${a.tags.join(' ')} ${a.note}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  list = [...list].sort((a, b) => {
    if (sortBy.value === 'name') return a.name.localeCompare(b.name)
    if (sortBy.value === 'duration') return b.durationMin - a.durationMin
    return a.priority - b.priority || b.durationMin - a.durationMin
  })
  return list
})

const plannedCount = computed(
  () => Object.keys(store.plannedAttractionDays).length,
)

function resetFilters() {
  search.value = ''
  parkFilter.value = 'all'
  typeFilter.value = 'all'
  intensityFilter.value = 'all'
  hidePlanned.value = false
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Attractions</h1>
        <p>
          A curated set of Orlando headliners. Filter, then drop each one onto a
          day of your trip.
        </p>
      </div>
      <ClientOnly>
        <span class="chip">
          <AppIcon name="check" :size="12" /> {{ plannedCount }} on your plan
        </span>
      </ClientOnly>
    </div>

    <div class="filters card card-pad">
      <label class="field filters__search">
        <span>Search</span>
        <input
          v-model="search"
          class="input"
          type="search"
          placeholder="Coaster, Butterbeer, single rider…"
        />
      </label>
      <label class="field">
        <span>Park</span>
        <select v-model="parkFilter" class="select">
          <option value="all">All parks</option>
          <option v-for="p in PARKS" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
      </label>
      <label class="field">
        <span>Type</span>
        <select v-model="typeFilter" class="select">
          <option value="all">Any type</option>
          <option v-for="t in types" :key="t" :value="t">
            {{ TYPE_LABEL[t] }}
          </option>
        </select>
      </label>
      <label class="field">
        <span>Intensity</span>
        <select v-model="intensityFilter" class="select">
          <option value="all">Any intensity</option>
          <option v-for="i in intensities" :key="i" :value="i">
            {{ INTENSITY_LABEL[i] }}
          </option>
        </select>
      </label>
      <label class="field">
        <span>Sort by</span>
        <select v-model="sortBy" class="select">
          <option value="priority">Priority</option>
          <option value="duration">Longest first</option>
          <option value="name">Name</option>
        </select>
      </label>
      <label class="filters__toggle">
        <input v-model="hidePlanned" type="checkbox" />
        <span>Hide ones I've planned</span>
      </label>
      <button type="button" class="btn btn-sm btn-ghost" @click="resetFilters">
        Reset
      </button>
    </div>

    <p class="results muted">{{ filtered.length }} attractions</p>

    <ClientOnly>
      <div v-if="filtered.length" class="grid acards">
        <AttractionCard
          v-for="a in filtered"
          :key="a.id"
          :attraction="a"
          :day-options="dayOptions"
          :planned-day="store.plannedAttractionDays[a.id] ?? null"
          @add="(day) => store.addAttractionToDay(day, a.id)"
          @remove="(day) => {
            const item = store.days[day]?.items.find((i) => i.attractionId === a.id)
            if (item) store.removeItem(day, item.id)
          }"
        />
      </div>
      <EmptyState
        v-else
        icon="ticket"
        title="Nothing matches those filters"
        message="Try widening the search or resetting the filters."
      />

      <template #fallback>
        <div class="grid acards">
          <div v-for="n in 6" :key="n" class="card sk-a" />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px 14px;
  align-items: end;
  margin-bottom: 12px;
}
.filters__search {
  grid-column: span 2;
  min-width: 220px;
}
.filters__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-muted);
  padding-bottom: 10px;
}
.results {
  font-size: 0.85rem;
  margin: 6px 2px 14px;
}
.acards {
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}
.sk-a {
  min-height: 210px;
}
@media (max-width: 560px) {
  .filters__search {
    grid-column: 1 / -1;
  }
}
</style>
