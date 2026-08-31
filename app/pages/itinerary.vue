<script setup lang="ts">
useHead({ title: 'Itinerary · Orlando Trip Planner' })

const store = useTripStore()
const { shortDate } = useFormat()

function addDay() {
  store.setDayCount(store.dayCount + 1)
}
function removeDay() {
  if (store.dayCount > 1) store.setDayCount(store.dayCount - 1)
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Itinerary</h1>
        <p>
          One card per day. Assign a park, then add rides, shows and meals — the
          order follows the times you set.
        </p>
      </div>
    </div>

    <ClientOnly>
      <div class="toolbar card card-pad">
        <div class="toolbar__stats">
          <span class="chip">
            <AppIcon name="calendar" :size="12" /> {{ store.dayCount }} days
          </span>
          <span class="chip">
            <AppIcon name="list" :size="12" /> {{ store.totalPlannedItems }} plans
          </span>
          <span class="chip">
            <AppIcon name="pin" :size="12" /> {{ store.parksInPlan.length }} parks
          </span>
        </div>
        <div class="toolbar__actions">
          <button
            type="button"
            class="btn btn-sm"
            :disabled="store.dayCount <= 1"
            @click="removeDay"
          >
            <AppIcon name="minus" :size="14" /> Remove day
          </button>
          <button type="button" class="btn btn-sm btn-primary" @click="addDay">
            <AppIcon name="plus" :size="14" /> Add day
          </button>
        </div>
      </div>

      <nav class="jump" aria-label="Jump to day">
        <a
          v-for="entry in store.schedule"
          :key="entry.index"
          :href="`#day-${entry.index + 1}`"
          class="jump__chip"
        >
          <strong>D{{ entry.index + 1 }}</strong>
          <span class="muted">{{ shortDate(entry.date) }}</span>
        </a>
      </nav>

      <div class="days">
        <div
          v-for="entry in store.schedule"
          :id="`day-${entry.index + 1}`"
          :key="entry.index"
          class="days__anchor"
        >
          <PlannerDayCard
            :day="entry.day"
            :index="entry.index"
            :date="entry.date"
            :day-count="store.dayCount"
          />
        </div>
      </div>

      <template #fallback>
        <div class="card sk" />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.toolbar__stats,
.toolbar__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.jump {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 10px;
  margin-bottom: 12px;
  scrollbar-width: thin;
}
.jump__chip {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elev);
  font-size: 0.78rem;
  white-space: nowrap;
}
.jump__chip:hover {
  border-color: var(--accent);
}
.days {
  display: grid;
  gap: 16px;
}
.days__anchor {
  scroll-margin-top: 140px;
}
.sk {
  min-height: 320px;
}
</style>
