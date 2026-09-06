<script setup lang="ts">
import { PARK_BY_ID, RESORTS } from '~/data/parks'
import { parseISO } from '~/composables/useDates'
import type { DayItem } from '~/types/trip'

const store = useTripStore()
const COL_DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

let pressTimer: ReturnType<typeof setTimeout> | undefined
let longFired = false

const popIndex = ref<number | null>(null)
watch(
  () => store.justSet,
  (i) => {
    if (i === null) return
    popIndex.value = i
    window.setTimeout(() => {
      popIndex.value = null
      store.clearJustSet()
    }, 360)
  },
)

function openDay(index: number) {
  store.selectDay(index)
  navigateTo('/day')
}

function start(index: number) {
  longFired = false
  clearTimeout(pressTimer)
  pressTimer = setTimeout(() => {
    longFired = true
    openDay(index)
  }, 400)
}
function end(index: number) {
  clearTimeout(pressTimer)
  if (!longFired) store.openSheet(index)
}
function cancel() {
  clearTimeout(pressTimer)
}

/** Dot colour matches the item's own park when it has one, or the day's. */
function itemDot(item: DayItem, dayParkId: string | null) {
  const effectiveParkId = item.parkId ?? dayParkId
  const park = effectiveParkId ? PARK_BY_ID[effectiveParkId] : null
  return {
    color: park
      ? RESORTS[park.resort].dot
      : item.kind === 'dining'
        ? 'var(--dot-dining)'
        : 'var(--dot-fixed)',
    title: park ? park.name : item.kind === 'dining' ? 'Dining' : 'Fixed time',
  }
}

function cellData(index: number) {
  const day = store.days[index]!
  const d = parseISO(day.date)
  const park = day.parkId ? PARK_BY_ID[day.parkId] ?? null : null
  // Budget is 3 slots total: all items if 3 or fewer, otherwise the first
  // two plus a "+N" badge for the rest.
  const visibleItems = day.items.length <= 3 ? day.items : day.items.slice(0, 2)
  const dots = visibleItems.map((it) => itemDot(it, day.parkId))
  const extra = day.items.length - visibleItems.length
  return {
    dateNumber: d.getUTCDate(),
    parkId: day.parkId,
    short: park?.short ?? '',
    dots,
    more: extra > 0 ? `+${extra}` : '',
    hotel: store.hotelsForDate(day.date).join(' + '),
  }
}
</script>

<template>
  <div class="weeks">
    <section v-for="(week, wi) in store.weeks" :key="wi" class="week">
      <header class="week__head">
        <span class="week__label">{{ week.label }}</span>
        <span class="week__range">{{ week.range }}</span>
      </header>
      <div class="week__grid">
        <template v-for="(cell, ci) in week.cells" :key="ci">
          <div v-if="cell === null" class="cell cell--blank" aria-hidden="true">
            <span class="cell__dow">{{ COL_DOW[ci] }}</span>
          </div>
          <button
            v-else
            type="button"
            class="cell"
            :aria-label="`Day ${cell + 1}`"
            @pointerdown="start(cell)"
            @pointerup="end(cell)"
            @pointerleave="cancel"
            @pointercancel="cancel"
            @click.prevent
            @contextmenu.prevent
            @keydown.enter.prevent="store.openSheet(cell)"
            @keydown.space.prevent="store.openSheet(cell)"
          >
            <span class="cell__dow">{{ COL_DOW[ci] }}</span>
            <DayCircle
              :class="{ 'anim-pop': popIndex === cell }"
              :park-id="cellData(cell).parkId"
              :date-number="cellData(cell).dateNumber"
              :size="40"
            />
            <span class="cell__short">{{ cellData(cell).short }}</span>
            <span class="cell__dots">
              <span
                v-for="(dot, di) in cellData(cell).dots"
                :key="di"
                class="cell__dot"
                :title="dot.title"
                :style="{ background: dot.color }"
              />
              <span v-if="cellData(cell).more" class="cell__more">{{
                cellData(cell).more
              }}</span>
            </span>
            <span
              v-if="cellData(cell).hotel"
              class="cell__hotel"
              :title="cellData(cell).hotel"
            >
              {{ cellData(cell).hotel }}
            </span>
          </button>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.weeks {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.week__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 4px 7px;
}
.week__label {
  font: 700 12px var(--font-ui);
  letter-spacing: 0.05em;
  color: var(--text-muted);
}
.week__range {
  font-size: 11.5px;
  color: var(--text-dim);
}
.week__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  background: #fff;
  border: 1px solid var(--warm-border);
  border-radius: var(--r-card);
  padding: 11px 5px 10px;
  box-shadow: var(--sh-week);
}
.cell {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 2px 0;
  touch-action: none;
  border-radius: 12px;
}
.cell--blank {
  opacity: 0;
  pointer-events: none;
}
.cell:active :deep(.circle) {
  transform: scale(0.9);
}
.cell :deep(.circle) {
  transition: transform 0.08s ease;
}
.cell__dow {
  font-size: 9.5px;
  font-weight: 600;
  color: var(--text-dim);
  letter-spacing: 0.03em;
}
.cell__short {
  font-size: 9px;
  font-weight: 600;
  color: var(--text-muted);
  line-height: 1.15;
  text-align: center;
  height: 11px;
  overflow: hidden;
  width: 100%;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.cell__dots {
  display: flex;
  gap: 2px;
  height: 5px;
  align-items: center;
}
.cell__dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
}
.cell__more {
  font-size: 8px;
  font-weight: 700;
  color: var(--text-dim);
  line-height: 1;
}
.cell__hotel {
  font-size: 8px;
  font-weight: 600;
  color: var(--text-dim);
  line-height: 1.1;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  margin-top: 1px;
}
</style>
