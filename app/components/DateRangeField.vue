<script setup lang="ts">
/**
 * A field that opens a bottom-sheet picker for choosing a start + end date
 * together, instead of two separate date boxes.
 *
 * Two variants:
 * - `calendar` (default) — a two-month calendar, for picking dates with no
 *   fixed bounds (the trip's own arrive/depart).
 * - `days` — the bounded range (`min`..`max`, both required) drawn as
 *   Monday-first week-rows of day circles, matching the overview's week grid.
 *   Used where the range is already clamped to a handful of trip days (a
 *   stay's optional date range) so there's no reason to show a generic month
 *   grid full of out-of-range days.
 */
import { addDays, parseISO, toISO, todayUTC } from '~/composables/useDates'

const props = withDefaults(
  defineProps<{
    start: string
    end: string
    min?: string
    max?: string
    placeholder?: string
    sheetTitle?: string
    compact?: boolean
    variant?: 'calendar' | 'days'
    /** ISO dates to mark with a subtle dot — e.g. "already booked" at another stay. */
    assignedDates?: string[]
  }>(),
  {
    min: '',
    max: '',
    placeholder: 'Add dates',
    sheetTitle: 'Select dates',
    compact: false,
    variant: 'calendar',
    assignedDates: () => [],
  },
)

const emit = defineEmits<{ update: [{ start: string; end: string }] }>()

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MON = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

const isOpen = ref(false)
const draftStart = ref('')
const draftEnd = ref('')
const viewMonth = ref(monthStart(todayUTC()))

const displayLabel = computed(() => {
  if (!props.start) return props.placeholder
  const a = parseISO(props.start)
  if (!props.end || props.end === props.start) {
    return `${a.getUTCDate()} ${MON[a.getUTCMonth()]} ${a.getUTCFullYear()}`
  }
  const b = parseISO(props.end)
  return `${a.getUTCDate()} ${MON[a.getUTCMonth()]} – ${b.getUTCDate()} ${MON[b.getUTCMonth()]} ${b.getUTCFullYear()}`
})

function openSheet() {
  draftStart.value = props.start
  draftEnd.value = props.end
  const seed = props.start ? parseISO(props.start) : props.min ? parseISO(props.min) : todayUTC()
  viewMonth.value = monthStart(seed)
  isOpen.value = true
}
function closeSheet() {
  isOpen.value = false
}

function monthGrid(month: Date): (Date | null)[] {
  const y = month.getUTCFullYear()
  const m = month.getUTCMonth()
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const pad = (month.getUTCDay() + 6) % 7
  const cells: (Date | null)[] = []
  for (let i = 0; i < pad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(Date.UTC(y, m, d)))
  return cells
}

/** Two consecutive months, so a range spanning a month-end is fully visible. */
const monthsToShow = computed(() => {
  const first = viewMonth.value
  const second = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1))
  return [first, second].map((m) => ({
    key: `${m.getUTCFullYear()}-${m.getUTCMonth()}`,
    date: m,
    label: `${MON[m.getUTCMonth()]} ${m.getUTCFullYear()}`,
    cells: monthGrid(m),
  }))
})
const navLabel = computed(() => {
  const [a, b] = monthsToShow.value
  if (!a || !b) return ''
  if (a.date.getUTCFullYear() === b.date.getUTCFullYear()) {
    return `${MON[a.date.getUTCMonth()]} – ${MON[b.date.getUTCMonth()]} ${a.date.getUTCFullYear()}`
  }
  return `${a.label} – ${b.label}`
})

function prevMonth() {
  const d = viewMonth.value
  viewMonth.value = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
}
function nextMonth() {
  const d = viewMonth.value
  viewMonth.value = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
}

/** Monday-first week rows spanning `min`..`max` inclusive, for the `days` variant. */
const dayWeeks = computed(() => {
  if (props.variant !== 'days' || !props.min || !props.max) return []
  const start = parseISO(props.min)
  const days: Date[] = []
  for (let d = start; toISO(d) <= props.max; d = addDays(d, 1)) days.push(d)
  const pad = (start.getUTCDay() + 6) % 7
  const cells: (Date | null)[] = []
  for (let i = 0; i < pad; i++) cells.push(null)
  days.forEach((d) => cells.push(d))
  while (cells.length % 7) cells.push(null)
  const weeks: (Date | null)[][] = []
  for (let w = 0; w * 7 < cells.length; w++) weeks.push(cells.slice(w * 7, w * 7 + 7))
  return weeks
})
const boundsLabel = computed(() => {
  if (props.variant !== 'days' || !props.min || !props.max) return ''
  const a = parseISO(props.min)
  const b = parseISO(props.max)
  return `Within your trip: ${a.getUTCDate()} ${MON[a.getUTCMonth()]} – ${b.getUTCDate()} ${MON[b.getUTCMonth()]}`
})

function isAssignedElsewhere(d: Date): boolean {
  return props.assignedDates.includes(toISO(d))
}

function isDisabled(d: Date): boolean {
  const iso = toISO(d)
  if (props.min && iso < props.min) return true
  if (props.max && iso > props.max) return true
  return false
}

function cellState(d: Date | null): string {
  if (!d) return ''
  const iso = toISO(d)
  if (draftStart.value && iso === draftStart.value) return 'start'
  if (draftEnd.value && iso === draftEnd.value) return 'end'
  if (draftStart.value && draftEnd.value && iso > draftStart.value && iso < draftEnd.value) {
    return 'mid'
  }
  return ''
}

function pick(d: Date | null) {
  if (!d || isDisabled(d)) return
  const iso = toISO(d)
  if (!draftStart.value || draftEnd.value) {
    draftStart.value = iso
    draftEnd.value = ''
    return
  }
  if (iso < draftStart.value) {
    draftStart.value = iso
    return
  }
  draftEnd.value = iso
}

const canConfirm = computed(() => Boolean(draftStart.value && draftEnd.value))

function confirm() {
  if (!canConfirm.value) return
  emit('update', { start: draftStart.value, end: draftEnd.value })
  closeSheet()
}
function clear() {
  emit('update', { start: '', end: '' })
  closeSheet()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closeSheet()
}
watch(isOpen, (open) => {
  if (typeof window === 'undefined') return
  if (open) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <button
    type="button"
    class="drf-trigger"
    :class="{ 'drf-trigger--compact': compact, 'drf-trigger--set': start }"
    @click="openSheet"
  >
    <AppIcon v-if="!compact" name="calendar" :size="16" class="drf-trigger__icon" />
    <span>{{ displayLabel }}</span>
  </button>

  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="isOpen" class="sheet-root">
        <div class="sheet-scrim" @click="closeSheet" />
        <div class="sheet" role="dialog" aria-modal="true" :aria-label="sheetTitle">
          <div class="sheet__handle" />
          <div class="sheet__head drf-head">
            <p class="sheet__title">{{ sheetTitle }}</p>
            <div v-if="variant === 'calendar'" class="drf-nav">
              <button type="button" class="drf-nav__btn" aria-label="Previous month" @click="prevMonth">
                <AppIcon name="arrowLeft" :size="16" />
              </button>
              <p class="drf-nav__label">{{ navLabel }}</p>
              <button type="button" class="drf-nav__btn drf-nav__btn--next" aria-label="Next month" @click="nextMonth">
                <AppIcon name="arrowLeft" :size="16" />
              </button>
            </div>
            <p v-else-if="boundsLabel" class="drf-bounds">{{ boundsLabel }}</p>
            <p v-if="variant === 'days' && assignedDates.length" class="drf-legend">
              <span class="drf-legend__dot" /> already has a hotel
            </p>
          </div>

          <div class="sheet__body drf-body">
            <template v-if="variant === 'calendar'">
              <div class="drf-months">
                <div v-for="m in monthsToShow" :key="m.key" class="drf-month">
                  <p class="drf-month__label">{{ m.label }}</p>
                  <div class="drf-dow">
                    <span v-for="d in DOW" :key="d">{{ d }}</span>
                  </div>
                  <div class="drf-grid">
                    <button
                      v-for="(d, i) in m.cells"
                      :key="i"
                      type="button"
                      class="drf-cell"
                      :class="[d ? `drf-cell--${cellState(d)}` : 'drf-cell--empty']"
                      :disabled="!d || isDisabled(d)"
                      @click="pick(d)"
                    >
                      {{ d ? d.getUTCDate() : '' }}
                    </button>
                  </div>
                </div>
              </div>
            </template>

            <template v-else>
              <p v-if="!dayWeeks.length" class="drf-empty-hint">Set your trip's dates first.</p>
              <div v-for="(week, wi) in dayWeeks" :key="wi" class="drf-week">
                <div v-for="(d, ci) in week" :key="ci" class="drf-daycol">
                  <template v-if="d">
                    <span class="drf-daycol__dow">{{ DOW[ci] }}</span>
                    <button
                      type="button"
                      class="drf-circle"
                      :class="`drf-circle--${cellState(d)}`"
                      @click="pick(d)"
                    >
                      {{ d.getUTCDate() }}
                      <span v-if="isAssignedElsewhere(d)" class="drf-circle__dot" />
                    </button>
                  </template>
                </div>
              </div>
            </template>
          </div>

          <div class="sheet__foot">
            <button type="button" class="sheet__btn sheet__btn--ghost" @click="clear">
              Clear
            </button>
            <button
              type="button"
              class="sheet__btn sheet__btn--go"
              :disabled="!canConfirm"
              @click="confirm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drf-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 14px;
  border: 1.5px solid var(--field-border);
  border-radius: var(--r-input);
  background: #fff;
  font-size: 16px;
  color: var(--text);
  text-align: left;
}
.drf-trigger:not(.drf-trigger--set) {
  color: var(--text-faint);
}
.drf-trigger--compact {
  width: auto;
  padding: 2px 0;
  border: 0;
  border-radius: 0;
  background: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-navy);
}
.drf-trigger--compact:not(.drf-trigger--set) {
  color: var(--c-navy);
}
.drf-trigger__icon {
  flex: none;
  color: var(--text-faint);
}

.sheet-root {
  position: fixed;
  inset: 0;
  z-index: 60;
}
.sheet-scrim {
  position: absolute;
  inset: 0;
  background: rgba(12, 16, 26, 0.42);
  animation: fadeIn 0.15s ease;
}
.sheet {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 100%;
  max-width: var(--app-max);
  transform: translateX(-50%);
  background: #fff;
  border-radius: 22px 22px 0 0;
  padding: 8px 0 max(26px, env(safe-area-inset-bottom));
  max-height: 84%;
  display: flex;
  flex-direction: column;
  animation: sheetUp 0.22s cubic-bezier(0.2, 0.8, 0.3, 1);
}
.sheet__handle {
  width: 38px;
  height: 4px;
  border-radius: 2px;
  background: #dfe3ec;
  margin: 6px auto 10px;
}
.sheet__head {
  padding: 0 20px 10px;
}
.sheet__title {
  font: 700 18px var(--font-display);
  color: var(--text);
}
.sheet__body {
  flex: 1;
  overflow-y: auto;
  padding: 0 14px;
}
.sheet__foot {
  padding: 10px 20px 0;
  display: flex;
  gap: 10px;
}
.sheet__btn {
  flex: 1;
  padding: 13px;
  border-radius: var(--r-sheet-tile);
  font-size: 14px;
  font-weight: 600;
  transition: transform 0.06s ease;
}
.sheet__btn:active {
  transform: scale(0.98);
}
.sheet__btn--ghost {
  background: #f2f4f9;
  color: var(--text-muted);
}
.sheet__btn--go {
  background: var(--c-navy);
  color: #fff;
}
.sheet__btn--go:disabled {
  background: #c2c8d6;
  cursor: not-allowed;
}

.drf-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.drf-nav__label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}
.drf-nav__btn {
  padding: 6px;
  border-radius: 8px;
  color: var(--text-muted);
}
.drf-nav__btn:active {
  background: #f2f4f9;
}
.drf-nav__btn--next {
  transform: scaleX(-1);
}
.drf-bounds {
  font-size: 12px;
  color: var(--text-faint);
  margin-top: 6px;
}
.drf-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--text-faint);
  margin-top: 6px;
}
.drf-legend__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c-teal);
}

.drf-months {
  display: flex;
  flex-direction: column;
}
@media (min-width: 700px) {
  .drf-months {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 22px;
    align-items: start;
  }
}
.drf-month {
  margin-bottom: 18px;
}
.drf-month:last-child {
  margin-bottom: 4px;
}
@media (min-width: 700px) {
  .drf-month {
    margin-bottom: 0;
  }
}
.drf-month__label {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.drf-dow {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 4px;
}
.drf-dow span {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-faint);
  padding: 6px 0;
}
.drf-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.drf-cell {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
  border-radius: 10px;
}
.drf-cell--empty {
  visibility: hidden;
}
.drf-cell:disabled {
  color: var(--text-dim);
  cursor: not-allowed;
}
.drf-cell--start,
.drf-cell--end {
  background: var(--c-navy);
  color: #fff;
}
.drf-cell--mid {
  background: var(--tile-selected);
  border-radius: 0;
}

.drf-empty-hint {
  font-size: 13px;
  color: var(--text-faint);
  padding: 20px 4px;
  text-align: center;
}
.drf-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 8px;
}
.drf-daycol {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}
.drf-daycol__dow {
  font-size: 9.5px;
  font-weight: 600;
  color: var(--text-dim);
}
.drf-circle {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  background: #fff;
  border: 1.5px solid var(--field-border-soft);
}
.drf-circle__dot {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--c-teal);
}
.drf-circle--mid {
  background: var(--tile-selected);
  border-color: var(--tile-selected);
  color: var(--text-muted);
}
.drf-circle--start,
.drf-circle--end {
  background: var(--c-navy);
  border-color: var(--c-navy);
  color: #fff;
}
</style>
