<script setup lang="ts">
import {
  CUSTOM_ACTIVITY_GLYPHS,
  GENERIC_ACTIVITY_IDS,
  PARK_BY_ID,
  RESORTS,
  SHEET_GROUPS,
} from '~/data/parks'
import { parseISO, useDates } from '~/composables/useDates'

const store = useTripStore()
const { dayMon } = useDates()

const title = computed(() => {
  const day = store.selected
  return day ? `Choose for ${dayMon(parseISO(day.date))}` : 'Choose activities'
})

/**
 * Up to two park ids in the order tapped (first = primary/first half,
 * second = park-hopper half). Each change is saved immediately so every
 * way of closing the sheet keeps the latest selection.
 */
const selection = ref<string[]>([])
const openGroups = ref<Set<string>>(new Set())

function resetOpenGroups() {
  const next = new Set(
    SHEET_GROUPS.filter((group) => group.defaultOpen).map((group) => group.key),
  )
  // If this day already uses an activity from a normally collapsed group,
  // reveal it when reopening the picker so its selected state is not hidden.
  for (const id of selection.value) {
    const selectedGroup = SHEET_GROUPS.find((group) => group.ids.includes(id))
    if (selectedGroup) next.add(selectedGroup.key)
  }
  openGroups.value = next
}

function toggleGroup(key: string) {
  const next = new Set(openGroups.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openGroups.value = next
}

function toggle(parkId: string) {
  if (selection.value.includes(parkId)) {
    selection.value = selection.value.filter((id) => id !== parkId)
  } else {
    const next = [...selection.value, parkId]
    selection.value = next.length > 2 ? next.slice(-2) : next
  }
  if (store.selectedDay === null) return
  const [first, second] = selection.value
  store.setDayActivities(store.selectedDay, first ?? null, second ?? null)
}
function clearDay() {
  selection.value = []
  if (store.selectedDay !== null) store.setDayActivities(store.selectedDay, null)
}

const customOpen = ref(false)
const customLabel = ref('')
const customGlyphId = ref(CUSTOM_ACTIVITY_GLYPHS[0]!.id)

function openCustomForm() {
  customLabel.value = ''
  customGlyphId.value = CUSTOM_ACTIVITY_GLYPHS[0]!.id
  customOpen.value = true
}
function saveCustomActivity() {
  const label = customLabel.value.trim()
  if (!label) return
  const glyph = CUSTOM_ACTIVITY_GLYPHS.find((g) => g.id === customGlyphId.value)!.glyph
  toggle(store.addCustomActivity(label, glyph))
  customOpen.value = false
}
/**
 * Closing normally fades the sheet out — nice on this page, but a full
 * navigation swaps the whole screen underneath at the same time, so the
 * fading sheet is briefly left stacked on top of the new page. Skip the
 * animation for this one case so "Open day" reads as instant.
 */
const instantClose = ref(false)
function openDay() {
  const dayId = store.selectedDay === null ? null : store.days[store.selectedDay]?.id
  store.closeSheet()
  instantClose.value = true
  navigateTo(dayId ? { path: '/plan', query: { day: dayId } } : '/plan')
}

/**
 * A `duration: 0` CSS-transition override can fail to fire its completion
 * event in some browsers, leaving Vue waiting forever to remove the leaving
 * element — which then sits full-screen over every page after it,
 * `pointer-events` and all, silently eating scroll/click input app-wide.
 * Switching to JS-hook mode for this one case and calling `done()`
 * ourselves is the reliable way to skip a transition. Only attach this
 * callback for instant closes: a two-argument leave hook makes Vue wait
 * for done() even when CSS transitions are enabled.
 */
function onLeave(_el: Element, done: () => void) {
  done()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') store.closeSheet()
}
watch(
  () => store.sheetOpen,
  (open) => {
    if (open) {
      instantClose.value = false
      customOpen.value = false
      const day = store.selected
      selection.value = day
        ? [day.parkId, day.secondParkId].filter((id): id is string => Boolean(id))
        : []
      resetOpenGroups()
    }
    if (typeof window === 'undefined') return
    if (open) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  },
)
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Transition name="sheet" :css="!instantClose" :on-leave="instantClose ? onLeave : undefined">
    <div v-if="store.sheetOpen" class="sheet-root">
      <div class="sheet-scrim" @click="store.closeSheet()" />
      <div class="sheet" role="dialog" aria-modal="true" :aria-label="title">
        <div class="sheet__handle" />
        <div class="sheet__head">
          <p class="sheet__title">{{ title }}</p>
          <p class="sheet__sub">
            Tap up to two activities. Changes save automatically.
          </p>
        </div>

        <div class="sheet__body">
          <div class="sgroup sgroup--quick">
            <p class="sgroup__label">Quick choices</p>
            <div class="sgroup__grid">
              <button
                v-for="pid in GENERIC_ACTIVITY_IDS"
                :key="pid"
                type="button"
                class="tile"
                :class="{ 'tile--on': selection.includes(pid) }"
                :aria-pressed="selection.includes(pid)"
                :title="PARK_BY_ID[pid]?.name"
                @click="toggle(pid)"
              >
                <DayCircle :park-id="pid" :size="42" />
                <span class="tile__label">{{ PARK_BY_ID[pid]?.short }}</span>
              </button>
              <button
                v-for="c in store.customActivities"
                :key="c.id"
                type="button"
                class="tile"
                :class="{ 'tile--on': selection.includes(c.id) }"
                :aria-pressed="selection.includes(c.id)"
                @click="toggle(c.id)"
              >
                <DayCircle :park-id="c.id" :size="42" />
                <span class="tile__label">{{ c.short }}</span>
              </button>
              <button type="button" class="tile" @click="openCustomForm">
                <span class="tile__add"><AppIcon name="plus" :size="18" /></span>
                <span class="tile__label">Custom</span>
              </button>
            </div>

            <div v-if="customOpen" class="custom-form">
              <input
                v-model="customLabel"
                class="input input--sm"
                type="text"
                placeholder="e.g. Spa day, Golf"
                maxlength="24"
                autofocus
              />
              <div class="custom-form__glyphs">
                <button
                  v-for="g in CUSTOM_ACTIVITY_GLYPHS"
                  :key="g.id"
                  type="button"
                  class="custom-form__glyph"
                  :class="{ 'custom-form__glyph--on': customGlyphId === g.id }"
                  @click="customGlyphId = g.id"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path :d="g.glyph" />
                  </svg>
                </button>
              </div>
              <div class="custom-form__actions">
                <button type="button" class="custom-form__btn" @click="customOpen = false">
                  Cancel
                </button>
                <button
                  type="button"
                  class="custom-form__btn custom-form__btn--go"
                  :disabled="!customLabel.trim()"
                  @click="saveCustomActivity"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div class="activity-groups">
            <section v-for="group in SHEET_GROUPS" :key="group.key" class="accordion">
              <button
                type="button"
                class="accordion__trigger"
                :aria-expanded="openGroups.has(group.key)"
                :aria-controls="`activity-group-${group.key}`"
                @click="toggleGroup(group.key)"
              >
                <span class="accordion__dot" :style="{ background: RESORTS[group.key].bg }" />
                <span>{{ group.title }}</span>
                <span class="accordion__count">{{ group.ids.length }}</span>
                <span class="accordion__chevron" :class="{ 'accordion__chevron--open': openGroups.has(group.key) }" aria-hidden="true">⌄</span>
              </button>
              <div
                v-show="openGroups.has(group.key)"
                :id="`activity-group-${group.key}`"
                class="accordion__panel"
              >
                <div class="sgroup__grid">
                  <button
                    v-for="pid in group.ids"
                    :key="pid"
                    type="button"
                    class="tile"
                    :class="{ 'tile--on': selection.includes(pid) }"
                    :aria-pressed="selection.includes(pid)"
                    :title="PARK_BY_ID[pid]?.name"
                    @click="toggle(pid)"
                  >
                    <DayCircle :park-id="pid" :size="42" />
                    <span class="tile__label">{{ PARK_BY_ID[pid]?.short }}</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div class="sheet__foot">
          <button type="button" class="sheet__btn sheet__btn--ghost" @click="clearDay">
            Clear day
          </button>
          <button type="button" class="sheet__btn sheet__btn--ghost" @click="openDay">
            Open day
          </button>
          <button type="button" class="sheet__btn sheet__btn--go" @click="store.closeSheet()">
            Close
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sheet-root {
  position: fixed;
  inset: 0;
  height: 100dvh;
  z-index: 40;
  overflow: hidden;
}
.sheet-scrim {
  position: absolute;
  inset: 0;
  background: rgba(12, 16, 26, 0.42);
  animation: fadeIn 0.15s ease;
}
.sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  max-width: var(--app-max);
  margin-inline: auto;
  background: #fff;
  border-radius: 22px 22px 0 0;
  padding: 8px 0 max(26px, env(safe-area-inset-bottom));
  max-height: min(78dvh, 720px);
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
.sheet__sub {
  font-size: 12.5px;
  color: var(--text-faint);
  margin-top: 2px;
}
.sheet__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 0 14px;
  scrollbar-width: none;
}
.sheet__body::-webkit-scrollbar {
  display: none;
}
.sgroup {
  margin-bottom: 12px;
}
.sgroup--quick {
  padding-bottom: 4px;
}
.sgroup--quick .sgroup__grid {
  grid-template-columns: repeat(5, 1fr);
}
.sgroup__label {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-dim);
  padding: 0 6px 6px;
}
.sgroup__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}
.activity-groups {
  margin: 0 -2px 12px;
  border-top: 1px solid var(--field-border-soft);
}
.accordion {
  border-bottom: 1px solid var(--field-border-soft);
}
.accordion__trigger {
  width: 100%;
  min-height: 48px;
  padding: 0 8px;
  display: grid;
  grid-template-columns: 9px minmax(0, 1fr) auto 18px;
  align-items: center;
  gap: 9px;
  color: var(--text);
  text-align: left;
  font-size: 13px;
  font-weight: 700;
}
.accordion__trigger:active {
  background: #f7f8fb;
}
.accordion__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.accordion__count {
  min-width: 23px;
  padding: 2px 7px;
  border-radius: 999px;
  background: #f1f3f7;
  color: var(--text-faint);
  font-size: 10.5px;
  font-weight: 700;
  text-align: center;
}
.accordion__chevron {
  color: var(--text-faint);
  font-size: 18px;
  line-height: 1;
  text-align: center;
  transform: rotate(-90deg);
  transition: transform 0.15s ease;
}
.accordion__chevron--open {
  transform: rotate(0deg);
}
.accordion__panel {
  padding: 0 4px 8px;
}
.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 9px 2px;
  border-radius: var(--r-sheet-tile);
  background: transparent;
  transition: transform 0.06s ease, background 0.12s ease;
}
.tile--on {
  background: var(--tile-selected);
}
.tile:active {
  transform: scale(0.94);
}
.tile__label {
  font-size: 9.5px;
  font-weight: 600;
  color: var(--text-muted);
  line-height: 1.15;
  text-align: center;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
.tile__add {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #f2f4f9;
  color: var(--text-faint);
}

.custom-form {
  margin-top: 6px;
  padding: 12px;
  border-radius: var(--r-sheet-tile);
  background: #f8f9fb;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.custom-form__glyphs {
  display: flex;
  gap: 8px;
}
.custom-form__glyph {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #fff;
  border: 1.5px solid var(--field-border-soft);
  color: var(--text-muted);
}
.custom-form__glyph--on {
  background: var(--c-navy);
  border-color: var(--c-navy);
  color: #fff;
}
.custom-form__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.custom-form__btn {
  padding: 8px 14px;
  border-radius: var(--r-sheet-tile);
  font-size: 13px;
  font-weight: 600;
  background: #eef0f4;
  color: var(--text-muted);
}
.custom-form__btn--go {
  background: var(--c-navy);
  color: #fff;
}
.custom-form__btn--go:disabled {
  background: #c2c8d6;
  cursor: not-allowed;
}
.sheet__foot {
  flex: none;
  padding: 6px 20px 0;
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

.sheet-leave-active {
  transition: opacity 0.18s ease;
}
.sheet-leave-to {
  opacity: 0;
}
</style>
