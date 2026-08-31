<script setup lang="ts">
import { ATTRACTIONS } from '~/data/attractions'
import { PARK_BY_ID } from '~/data/parks'

useHead({ title: 'Dashboard · Orlando Trip Planner' })

const store = useTripStore()
const { money, fullDate, shortDate } = useFormat()

const hasDates = computed(() => Boolean(store.trip.startDate))

const unplannedMustDos = computed(() => {
  const planned = store.plannedAttractionDays
  return ATTRACTIONS.filter((a) => a.priority === 1 && !(a.id in planned)).slice(
    0,
    6,
  )
})

const packing = computed(() => store.packingProgress)
</script>

<template>
  <div>
    <ClientOnly>
      <section class="hero card">
        <div class="hero__body">
          <p class="hero__eyebrow">
            <AppIcon name="sparkles" :size="14" /> Your trip
          </p>
          <h1>{{ store.trip.name }}</h1>
          <p class="hero__dates">
            <template v-if="hasDates">
              {{ fullDate(store.schedule[0]?.date ?? null) }}
              <span class="muted">→</span>
              {{ shortDate(store.endDate) }}
              · {{ store.dayCount }} days · party of {{ store.trip.partySize }}
            </template>
            <template v-else>
              No dates yet — add them in Settings to unlock the countdown and a
              dated itinerary.
            </template>
          </p>
          <p v-if="store.trip.homeBase" class="muted hero__base">
            <AppIcon name="pin" :size="13" /> {{ store.trip.homeBase }}
          </p>

          <div class="hero__cta">
            <NuxtLink to="/itinerary" class="btn btn-primary">
              <AppIcon name="map" :size="16" /> Open itinerary
            </NuxtLink>
            <NuxtLink to="/settings" class="btn">Trip settings</NuxtLink>
            <button
              v-if="!store.totalPlannedItems"
              type="button"
              class="btn btn-ghost"
              @click="store.loadDemo()"
            >
              <AppIcon name="sparkles" :size="15" /> Load a demo trip
            </button>
          </div>
        </div>
        <div class="hero__count" :class="{ 'hero__count--muted': !hasDates }">
          <template v-if="hasDates && store.daysUntilStart !== null">
            <span class="hero__count-num">{{
              Math.max(store.daysUntilStart, 0)
            }}</span>
            <span class="hero__count-label">
              {{
                store.daysUntilStart > 0
                  ? 'days to go'
                  : store.daysUntilStart === 0
                    ? 'today!'
                    : 'enjoy the trip'
              }}
            </span>
          </template>
          <template v-else>
            <AppIcon name="calendar" :size="30" />
            <span class="hero__count-label">Set your dates</span>
          </template>
        </div>
      </section>

      <div class="grid stats-grid">
        <StatCard
          label="Days planned"
          :value="`${store.parksInPlan.length}/${store.dayCount}`"
          hint="days with a park assigned"
          icon="calendar"
          :accent="'var(--c-navy)'"
          to="/itinerary"
        />
        <StatCard
          label="Attractions"
          :value="Object.keys(store.plannedAttractionDays).length"
          :hint="`${store.totalPlannedItems} plans in total`"
          icon="ticket"
          :accent="'var(--c-teal)'"
          to="/attractions"
        />
        <StatCard
          label="Budget left"
          :value="money(store.budgetRemaining)"
          :hint="`of ${money(store.budgetTotal)} · ${money(store.perPersonSpend)}/person spent`"
          icon="wallet"
          :accent="store.budgetRemaining < 0 ? 'var(--danger)' : 'var(--c-coral)'"
          to="/budget"
        />
        <StatCard
          label="Packing"
          :value="`${packing.pct}%`"
          :hint="`${packing.done} of ${packing.total} packed`"
          icon="bag"
          :accent="'var(--c-sun)'"
          to="/packing"
        />
      </div>

      <div class="cols">
        <section class="card card-pad">
          <div class="section-title">
            <AppIcon name="map" :size="18" />
            <h2>Day by day</h2>
          </div>
          <ol class="daylist" role="list">
            <li v-for="entry in store.schedule" :key="entry.index" class="daylist__row">
              <NuxtLink to="/itinerary" class="daylist__link">
                <span class="daylist__num">{{ entry.index + 1 }}</span>
                <span class="daylist__info">
                  <span class="daylist__park">
                    {{
                      entry.day.parkId
                        ? PARK_BY_ID[entry.day.parkId]?.name
                        : 'No park set'
                    }}
                  </span>
                  <span class="daylist__meta muted">
                    {{ shortDate(entry.date) }} · {{ entry.day.items.length }}
                    {{ entry.day.items.length === 1 ? 'plan' : 'plans' }}
                  </span>
                </span>
                <span
                  class="daylist__swatch"
                  :style="{
                    background: entry.day.parkId
                      ? PARK_BY_ID[entry.day.parkId]?.color
                      : 'var(--border-strong)',
                  }"
                />
              </NuxtLink>
            </li>
          </ol>
        </section>

        <section class="card card-pad">
          <div class="section-title">
            <AppIcon name="bolt" :size="18" />
            <h2>Must-dos to slot in</h2>
          </div>
          <p v-if="!unplannedMustDos.length" class="muted">
            Every headliner is on the schedule. Nicely done. 🎢
          </p>
          <ul v-else role="list" class="mustdo">
            <li v-for="a in unplannedMustDos" :key="a.id" class="mustdo__row">
              <span
                class="mustdo__dot"
                :style="{ background: PARK_BY_ID[a.parkId]?.color }"
              />
              <span class="mustdo__name">{{ a.name }}</span>
              <span class="mustdo__park muted">{{
                PARK_BY_ID[a.parkId]?.short
              }}</span>
            </li>
          </ul>
          <NuxtLink to="/attractions" class="btn btn-sm mustdo__cta">
            Browse attractions <AppIcon name="arrowRight" :size="14" />
          </NuxtLink>
        </section>
      </div>

      <template #fallback>
        <div class="hero card hero--skeleton" />
        <div class="grid stats-grid">
          <div v-for="n in 4" :key="n" class="card sk-card" />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.hero {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 20px;
  align-items: center;
  padding: clamp(20px, 4vw, 34px);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--c-navy) 12%, var(--bg-elev)),
    var(--bg-elev) 60%
  );
  margin-bottom: 22px;
}
.hero--skeleton {
  min-height: 190px;
}
.hero__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
}
.hero h1 {
  margin: 6px 0 8px;
}
.hero__dates {
  color: var(--text-muted);
  max-width: 52ch;
}
.hero__base {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.86rem;
  margin-top: 6px;
}
.hero__cta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}
.hero__count {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 2px;
  min-width: 132px;
  padding: 18px 22px;
  border-radius: var(--radius-lg);
  background: var(--c-navy);
  color: #fff;
}
.hero__count--muted {
  background: var(--bg-sunk);
  color: var(--text-muted);
}
.hero__count-num {
  font-family: var(--font-display);
  font-size: 3rem;
  font-weight: 720;
  line-height: 1;
}
.hero__count-label {
  font-size: 0.82rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: center;
}

.stats-grid {
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  margin-bottom: 22px;
}
.sk-card {
  min-height: 116px;
}

.cols {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 18px;
}
@media (max-width: 820px) {
  .hero {
    grid-template-columns: 1fr;
  }
  .hero__count {
    justify-self: start;
  }
  .cols {
    grid-template-columns: 1fr;
  }
}

.daylist {
  display: grid;
  gap: 4px;
  padding: 0;
}
.daylist__link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: var(--radius-sm);
  transition: background 0.12s ease;
}
.daylist__link:hover {
  background: var(--bg-sunk);
}
.daylist__num {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--bg-sunk);
  font-weight: 700;
  font-size: 0.82rem;
  flex: none;
}
.daylist__info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.daylist__park {
  font-weight: 600;
}
.daylist__meta {
  font-size: 0.8rem;
}
.daylist__swatch {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
}

.mustdo {
  display: grid;
  gap: 8px;
}
.mustdo__row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.92rem;
}
.mustdo__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
.mustdo__name {
  flex: 1;
  min-width: 0;
}
.mustdo__park {
  font-size: 0.78rem;
  font-weight: 700;
}
.mustdo__cta {
  margin-top: 14px;
}
</style>
