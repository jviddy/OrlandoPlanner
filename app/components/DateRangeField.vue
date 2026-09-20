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
import { useCrowdPredictions } from '~/composables/useCrowdPredictions'

const { ensureLoaded: ensureCrowdsLoaded, prediction: crowdPrediction, backgroundStyle: crowdBackgroundStyle } = useCrowdPredictions()

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
const triggerRef = ref<HTMLButtonElement | null>(null)
const hoverDate = ref('')

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
  void ensureCrowdsLoaded()
}
function closeSheet() {
  isOpen.value = false
  nextTick(() => triggerRef.value?.focus())
}

function monthGrid(month: Date): (Date | null)[] {
  const y = month.getUTCFullYear()
  const m = month.getUTCMonth()
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const pad = (month.getUTCDay() + 6) % 7
  const cells: (Date | null)[] = []
  for (let i = 0; i < pad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(Date.UTC(y, m, d)))
  // Always render 6 weeks so the month block height stays constant.
  while (cells.length < 42) cells.push(null)
  return cells
}

const yearOptions = computed(() => {
  const current = viewMonth.value.getUTCFullYear()
  const start = current - 3
  const end = current + 5
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
})
const monthsToJump = computed(() => {
  const options: { year: number; month: number }[] = []
  for (const year of yearOptions.value) {
    for (let month = 0; month < 12; month++) {
      options.push({ year, month })
    }
  }
  return options
})

function setYearMonth(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  const [yearStr, monthStr] = value.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!Number.isNaN(year) && !Number.isNaN(month)) {
    viewMonth.value = new Date(Date.UTC(year, month, 1))
  }
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

function rangeState(start: string, end: string, iso: string): 'start' | 'end' | 'mid' | '' {
  if (!start) return ''
  if (iso === start) return 'start'
  if (!end) return ''
  if (iso === end) return 'end'
  if (iso > start && iso < end) return 'mid'
  return ''
}

function cellState(d: Date | null): 'start' | 'end' | 'mid' | 'preview-start' | 'preview-end' | 'preview-mid' | '' {
  if (!d) return ''
  const iso = toISO(d)
  const existing = rangeState(draftStart.value, draftEnd.value, iso)
  if (existing) return existing
  if (!draftStart.value || draftEnd.value || !hoverDate.value) return ''
  const anchor = draftStart.value
  const probe = hoverDate.value
  if (probe === anchor) return ''
  if (probe < anchor) {
    if (iso === probe) return 'preview-start'
    if (iso > probe && iso < anchor) return 'preview-mid'
    if (iso === anchor) return 'preview-end'
  } else {
    if (iso === anchor) return 'preview-start'
    if (iso > anchor && iso < probe) return 'preview-mid'
    if (iso === probe) return 'preview-end'
  }
  return ''
}

function crowdTitle(d: Date): string {
  const result = crowdPrediction(toISO(d))
  return result ? `Predicted Orlando crowd: ${result.label}, ${result.score}/${result.max}` : ''
}

function pick(d: Date | null) {
  if (!d || isDisabled(d)) return
  const iso = toISO(d)
  // If the range is complete, clicking inside it keeps the selection so the
  // user can confirm without accidentally blanking the end date.
  if (draftStart.value && draftEnd.value) {
    if (iso >= draftStart.value && iso <= draftEnd.value) return
    draftStart.value = iso
    draftEnd.value = ''
    return
  }
  if (!draftStart.value) {
    draftStart.value = iso
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
    ref="triggerRef"
    type="button"
    class="drf-trigger"
    :class="{ 'drf-trigger--compact': compact, 'drf-trigger--set': start }"
    tabindex="0"
    @click="openSheet"
    @keydown.enter.prevent="openSheet"
    @keydown.space.prevent="openSheet"
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
              <label class="drf-year" aria-label="Jump to year and month">
                <select @change="setYearMonth">
                  <option
                    v-for="m in monthsToJump"
                    :key="`${m.year}-${m.month}`"
                    :value="`${m.year}-${m.month}`"
                    :selected="m.year === viewMonth.getUTCFullYear() && m.month === viewMonth.getUTCMonth()"
                  >
                    {{ MON[m.month] }} {{ m.year }}
                  </option>
                </select>
              </label>
            </div>
            <p v-else-if="boundsLabel" class="drf-bounds">{{ boundsLabel }}</p>
            <p v-if="variant === 'days' && assignedDates.length" class="drf-legend">
              <span class="drf-legend__dot" /> already has a hotel
            </p>
            <div class="drf-crowd-key" aria-label="Date backgrounds show predicted Orlando crowds from low to high">
              <span>Predicted crowds</span>
              <i v-for="level in 5" :key="level" :class="`drf-crowd-key__level-${level}`" />
              <small>Low → high</small>
            </div>
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
                      :class="d ? (cellState(d) ? `drf-cell--${cellState(d)}` : '') : 'drf-cell--empty'"
                      :disabled="!d || isDisabled(d)"
                      :style="d && !isDisabled(d) ? crowdBackgroundStyle(toISO(d)) : undefined"
                      :title="d ? crowdTitle(d) : undefined"
                      :aria-label="d ? `${toISO(d)}${crowdTitle(d) ? `. ${crowdTitle(d)}` : ''}` : undefined"
                      @click="pick(d)"
                      @mouseenter="d ? hoverDate = toISO(d) : null"
                      @mouseleave="hoverDate = ''"
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
                      :class="cellState(d) ? `drf-circle--${cellState(d)}` : ''"
                      :style="crowdBackgroundStyle(toISO(d))"
                      :title="crowdTitle(d)"
                      :aria-label="`${toISO(d)}${crowdTitle(d) ? `. ${crowdTitle(d)}` : ''}`"
                      @click="pick(d)"
                      @mouseenter="hoverDate = toISO(d)"
                      @mouseleave="hoverDate = ''"
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
.drf-trigger:focus-visible {
  outline: 2px solid var(--c-navy);
  outline-offset: 2px;
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
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.drf-nav__label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  text-align: center;
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
.drf-year {
  margin-left: auto;
}
.drf-year select {
  height: 30px;
  padding: 0 22px 0 8px;
  border-radius: 8px;
  border: 1px solid var(--field-border);
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23687386' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
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
.drf-crowd-key {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 7px;
  color: var(--text-faint);
  font-size: 10px;
}
.drf-crowd-key span { margin-right: 2px; font-weight: 700; }
.drf-crowd-key i { width: 10px; height: 10px; border-radius: 3px; }
.drf-crowd-key small { margin-left: 2px; font-size: 9px; }
.drf-crowd-key__level-1 { background: #edf7f3; }
.drf-crowd-key__level-2 { background: #f3f7e9; }
.drf-crowd-key__level-3 { background: #fff7e2; }
.drf-crowd-key__level-4 { background: #fdf0e7; }
.drf-crowd-key__level-5 { background: #f8e7e3; }

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
  gap: 0;
}
.drf-cell {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
  border-radius: 10px;
  position: relative;
  margin: 1px;
  background: var(--crowd-bg, transparent);
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
  margin: 1px 0;
}
.drf-cell--mid::before,
.drf-cell--preview-mid::before {
  content: '';
  position: absolute;
  inset: 0 0 0 0;
  background: var(--tile-selected);
  z-index: -1;
}
.drf-cell--start::after,
.drf-cell--end::after,
.drf-cell--preview-start::after,
.drf-cell--preview-end::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: var(--c-navy);
  z-index: -1;
}
.drf-cell--preview-start,
.drf-cell--preview-end,
.drf-cell--preview-mid {
  color: var(--text);
}
.drf-cell--preview-start::after,
.drf-cell--preview-end::after {
  background: var(--tile-selected);
  opacity: 0.65;
}
.drf-cell--preview-mid {
  background: transparent;
}
.drf-cell--preview-mid::before {
  opacity: 0.65;
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
  background: var(--crowd-bg, #fff);
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
.drf-circle--mid,
.drf-circle--preview-mid {
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
.drf-circle--preview-start,
.drf-circle--preview-end,
.drf-circle--preview-mid {
  color: var(--text);
  background: var(--tile-selected);
  border-color: var(--tile-selected);
  opacity: 0.65;
}
</style>
