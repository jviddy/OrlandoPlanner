<script setup lang="ts">
const store = useTripStore()
const { dayCell } = useDayCell()

const DOW_FROM_SUNDAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
/**
 * The letters across the top of each week row. For the two calendar-aligned
 * modes this is just the fixed order; for `tripDay1` there's no padding at
 * all (see the store's `weeks` getter), so every row advances in exact
 * multiples of 7 days and column 0 always lands back on the trip's own
 * start weekday — so a fixed, anchored header still works.
 */
const colDow = computed(() => {
  if (store.weekStart === 'sunday') return DOW_FROM_SUNDAY
  if (store.weekStart === 'monday') return [...DOW_FROM_SUNDAY.slice(1), DOW_FROM_SUNDAY[0]!]
  const anchor = store.firstDate ? store.firstDate.getUTCDay() : 0
  return Array.from({ length: 7 }, (_, i) => DOW_FROM_SUNDAY[(anchor + i) % 7]!)
})

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
            <span class="cell__dow">{{ colDow[ci] }}</span>
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
            <span class="cell__dow">{{ colDow[ci] }}</span>
            <DayCircle
              :class="{ 'anim-pop': popIndex === cell }"
              :park-id="dayCell(cell).parkId"
              :second-park-id="dayCell(cell).secondParkId"
              :date-number="dayCell(cell).dateNumber"
              :size="40"
            />
            <span class="cell__short">{{ dayCell(cell).short }}</span>
            <span class="cell__dots">
              <span
                v-for="(dot, di) in dayCell(cell).dots"
                :key="di"
                class="cell__dot"
                :title="dot.title"
                :style="{ background: dot.color }"
              />
              <span v-if="dayCell(cell).more" class="cell__more">{{
                dayCell(cell).more
              }}</span>
            </span>
            <span
              v-if="dayCell(cell).hotel"
              class="cell__hotel"
              :title="dayCell(cell).hotel"
            >
              {{ dayCell(cell).hotel }}
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
