<script setup lang="ts">
import {
  CUSTOM_ACTIVITY_GLYPHS,
  GENERIC_ACTIVITY_IDS,
  PARKS,
  PARK_BY_ID,
  RESORTS,
  SHEET_GROUPS,
  resolvePark,
} from '~/data/parks'
import { parseISO, useDates } from '~/composables/useDates'

const store = useTripStore()
const route = useRoute()
const router = useRouter()
const { dayMon } = useDates()

const title = computed(() => {
  const day = store.selected
  return day ? `Choose for ${dayMon(parseISO(day.date))}` : 'Choose activities'
})

/**
 * Up to three activities in the order tapped. Each change is saved immediately so every
 * way of closing the sheet keeps the latest selection.
 */
const selection = ref<string[]>([])
const openGroups = ref<Set<string>>(new Set())
const searchQuery = ref('')
const autoAdvance = ref(false)

const activityCatalog = computed(() => [...PARKS, ...store.customActivities])
const recentChoices = computed(() => store.recentActivityIds.filter((id) => resolvePark(id, store.customActivities)))
const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  if (!query) return []
  return activityCatalog.value
    .filter((activity) => `${activity.name} ${activity.short}`.toLocaleLowerCase().includes(query))
    .slice(0, 16)
})
const usedChoices = computed(() => {
  const counts = new Map<string, number>()
  for (const day of store.days) {
    for (const id of [day.parkId, day.secondParkId, day.thirdParkId]) {
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .filter((id) => !GENERIC_ACTIVITY_IDS.includes(id as typeof GENERIC_ACTIVITY_IDS[number]))
    .filter((id) => !recentChoices.value.includes(id))
    .slice(0, 5)
})
const ticketChoices = computed(() => {
  const eligible = PARKS.filter((activity) =>
    (activity.resort === 'disney' && store.ticketDays.disney > 0)
    || (activity.resort === 'universal' && store.ticketDays.universal > 0),
  )
  const alreadySuggested = new Set([...recentChoices.value, ...usedChoices.value])
  return [
    ...eligible.filter((activity) => !alreadySuggested.has(activity.id)),
    ...eligible.filter((activity) => alreadySuggested.has(activity.id)),
  ].slice(0, 5)
})
const nearbyDays = computed(() => {
  if (store.selectedDay === null) return []
  return [-1, 0, 1]
    .map((offset) => ({ offset, day: store.days[store.selectedDay! + offset] }))
    .filter((entry) => entry.day)
})
const fixedAnchorCount = computed(() => store.selected?.items.filter((item) => item.anchor === 'date').length ?? 0)

function syncSelectionFromDay() {
  const day = store.selected
  selection.value = day
    ? [day.parkId, day.secondParkId, day.thirdParkId].filter((id): id is string => Boolean(id))
    : []
}

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

function choose(parkId: string) {
  if (store.selectedDay === null) return
  const wasUnset = selection.value.length === 0
  selection.value = selection.value.includes(parkId)
    ? selection.value.filter((id) => id !== parkId)
    : selection.value.length < 3 ? [...selection.value, parkId] : selection.value
  persistSelection()
  if (autoAdvance.value && wasUnset && selection.value[0]) nextTick(moveToNextUnset)
}
function persistSelection() {
  if (store.selectedDay === null) return
  const [first, second, third] = selection.value
  store.setDayActivities(store.selectedDay, first ?? null, second ?? null, third ?? null)
}
function removeActivity(parkId: string) {
  choose(parkId)
}
function moveActivity(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= selection.value.length) return
  const next = [...selection.value]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  selection.value = next
  persistSelection()
}

const previousAvailable = computed(() => (store.selectedDay ?? 0) > 0)
const nextAvailable = computed(() => (store.selectedDay ?? 0) < store.days.length - 1)
const nextUnsetIndex = computed(() => {
  if (store.selectedDay === null || !store.days.length) return -1
  for (let offset = 1; offset < store.days.length; offset++) {
    const index = (store.selectedDay + offset) % store.days.length
    if (!store.days[index]?.parkId) return index
  }
  return -1
})

function selectDay(index: number) {
  const day = store.days[index]
  if (!day) return
  store.selectDay(index)
  if (route.path === '/plan') router.replace({ path: '/plan', query: { day: day.id } })
}
function moveDay(direction: -1 | 1) {
  if (store.selectedDay === null) return
  selectDay(store.selectedDay + direction)
}
function moveToNextUnset() {
  if (nextUnsetIndex.value >= 0) selectDay(nextUnsetIndex.value)
}
function undoLastChange() {
  store.undoLastChange()
  syncSelectionFromDay()
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
  choose(store.addCustomActivity(label, glyph))
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
  () => [store.sheetOpen, store.selectedDay] as const,
  ([open]) => {
    if (open) {
      instantClose.value = false
      customOpen.value = false
      searchQuery.value = ''
      syncSelectionFromDay()
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
          <div class="sheet__nav" aria-label="Move between trip days">
            <button type="button" aria-label="Previous day" :disabled="!previousAvailable" @click="moveDay(-1)">←</button>
            <p class="sheet__title">{{ title }}</p>
            <button type="button" aria-label="Next day" :disabled="!nextAvailable" @click="moveDay(1)">→</button>
          </div>
          <div v-if="store.undo" class="sheet__undo" role="status" aria-live="polite">
            <span>{{ store.undo.label }}</span>
            <button type="button" @click="undoLastChange">Undo</button>
          </div>
        </div>

        <div class="sheet__body">
          <div class="decision-context" aria-label="Planning context">
            <div class="nearby-days">
              <div v-for="entry in nearbyDays" :key="entry.day!.id" :class="{ 'nearby-day--current': entry.offset === 0 }">
                <span>{{ entry.offset === -1 ? 'Yesterday' : entry.offset === 1 ? 'Tomorrow' : 'This day' }}</span>
                <strong>{{ entry.day!.parkId ? resolvePark(entry.day!.parkId, store.customActivities)?.short : 'Unset' }}</strong>
              </div>
            </div>
            <p v-if="fixedAnchorCount" class="anchor-note">{{ fixedAnchorCount }} date-fixed {{ fixedAnchorCount === 1 ? 'booking stays' : 'bookings stay' }} on this day.</p>
          </div>

          <div v-if="selection[0]" class="selected-plan">
            <div v-for="(parkId, index) in selection" :key="parkId">
              <span>{{ index === 0 ? 'Main plan' : `Activity ${index + 1}` }}</span>
              <strong>{{ resolvePark(parkId, store.customActivities)?.name }}</strong>
              <div class="selected-plan__controls">
                <button type="button" :disabled="index === 0" :aria-label="`Move ${resolvePark(parkId, store.customActivities)?.name} earlier`" @click="moveActivity(index, -1)">↑</button>
                <button type="button" :disabled="index === selection.length - 1" :aria-label="`Move ${resolvePark(parkId, store.customActivities)?.name} later`" @click="moveActivity(index, 1)">↓</button>
                <button type="button" class="selected-plan__remove" :aria-label="`Remove ${resolvePark(parkId, store.customActivities)?.name}`" @click="removeActivity(parkId)">×</button>
              </div>
            </div>
            <p v-if="selection.length < 3" class="selection-hint">Choose up to {{ 3 - selection.length }} more {{ selection.length === 2 ? 'activity' : 'activities' }} below.</p>
            <p v-else class="selection-hint">Three activities selected.</p>
            <p v-if="selection.length > 1 && !store.parkHopper" class="hopper-hint">Your trip settings are not currently marked as park hopper.</p>
          </div>

          <div class="activity-search">
            <input v-model="searchQuery" type="search" aria-label="Search activities" placeholder="Search parks and activities" />
          </div>

          <div v-if="searchQuery.trim()" class="sgroup">
            <p class="sgroup__label">Search results</p>
            <div v-if="searchResults.length" class="sgroup__grid">
              <button
                v-for="activity in searchResults"
                :key="activity.id"
                type="button"
                class="tile"
                :class="{ 'tile--on': selection.includes(activity.id) }"
                :aria-pressed="selection.includes(activity.id)"
                @click="choose(activity.id)"
              >
                <DayCircle :park-id="activity.id" :size="42" />
                <span class="tile__label">{{ activity.short }}</span>
              </button>
            </div>
            <p v-else class="search-empty">No matching activities.</p>
          </div>

          <template v-if="!searchQuery.trim()">
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
                    @click="choose(pid)"
                  >
                    <DayCircle :park-id="pid" :size="42" />
                    <span class="tile__label">{{ PARK_BY_ID[pid]?.short }}</span>
                  </button>
                  <template v-if="group.key === 'off'">
                    <button
                      v-for="activity in store.customActivities"
                      :key="activity.id"
                      type="button"
                      class="tile"
                      :class="{ 'tile--on': selection.includes(activity.id) }"
                      :aria-pressed="selection.includes(activity.id)"
                      @click="choose(activity.id)"
                    >
                      <DayCircle :park-id="activity.id" :size="42" />
                      <span class="tile__label">{{ activity.short }}</span>
                    </button>
                    <button type="button" class="tile" @click="openCustomForm">
                      <span class="tile__add"><AppIcon name="plus" :size="18" /></span>
                      <span class="tile__label">Custom</span>
                    </button>
                  </template>
                </div>
                <div v-if="group.key === 'off' && customOpen" class="custom-form">
                  <input v-model="customLabel" class="input input--sm" type="text" placeholder="e.g. Spa day, Golf" maxlength="24" autofocus />
                  <div class="custom-form__glyphs">
                    <button v-for="g in CUSTOM_ACTIVITY_GLYPHS" :key="g.id" type="button" class="custom-form__glyph" :class="{ 'custom-form__glyph--on': customGlyphId === g.id }" @click="customGlyphId = g.id">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="g.glyph" /></svg>
                    </button>
                  </div>
                  <div class="custom-form__actions">
                    <button type="button" class="custom-form__btn" @click="customOpen = false">Cancel</button>
                    <button type="button" class="custom-form__btn custom-form__btn--go" :disabled="!customLabel.trim()" @click="saveCustomActivity">Add</button>
                  </div>
                </div>
              </div>
            </section>
          </div>
          </template>

          <div v-if="!searchQuery.trim() && usedChoices.length" class="sgroup sgroup--used">
            <p class="sgroup__label">Used in this trip</p>
            <div class="sgroup__grid">
              <button
                v-for="pid in usedChoices"
                :key="pid"
                type="button"
                class="tile"
                :class="{ 'tile--on': selection.includes(pid) }"
                :aria-pressed="selection.includes(pid)"
                @click="choose(pid)"
              >
                <DayCircle :park-id="pid" :size="42" />
                <span class="tile__label">{{ resolvePark(pid, store.customActivities)?.short }}</span>
              </button>
            </div>
          </div>

          <div v-if="!searchQuery.trim() && recentChoices.length" class="sgroup sgroup--used">
            <p class="sgroup__label">Recently chosen</p>
            <div class="sgroup__grid">
              <button
                v-for="pid in recentChoices"
                :key="pid"
                type="button"
                class="tile"
                :class="{ 'tile--on': selection.includes(pid) }"
                :aria-pressed="selection.includes(pid)"
                @click="choose(pid)"
              >
                <DayCircle :park-id="pid" :size="42" />
                <span class="tile__label">{{ resolvePark(pid, store.customActivities)?.short }}</span>
              </button>
            </div>
          </div>

          <div v-if="!searchQuery.trim() && ticketChoices.length" class="sgroup sgroup--used">
            <p class="sgroup__label">Matches your tickets</p>
            <div class="sgroup__grid">
              <button
                v-for="activity in ticketChoices"
                :key="activity.id"
                type="button"
                class="tile"
                :class="{ 'tile--on': selection.includes(activity.id) }"
                :aria-pressed="selection.includes(activity.id)"
                @click="choose(activity.id)"
              >
                <DayCircle :park-id="activity.id" :size="42" />
                <span class="tile__label">{{ activity.short }}</span>
              </button>
            </div>
          </div>

          <label class="auto-advance">
            <input v-model="autoAdvance" type="checkbox" />
            <span>Advance to the next unset day after choosing</span>
          </label>
        </div>

        <div class="sheet__foot">
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
.sheet__head { padding:0 14px 8px; }
.sheet__nav {
  display:grid; grid-template-columns:32px minmax(0,1fr) 32px; align-items:center; gap:8px;
}
.sheet__nav button {
  width:32px; height:32px; padding:0; border-radius:50%;
  background:#f2f4f9;
  color:var(--c-navy);
  font-size:18px;
  font-weight:700;
}
.sheet__nav button:disabled { color:var(--text-dim); cursor:default; }
.sheet__undo {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-top:7px;
  padding:8px 10px;
  border-radius:10px;
  background:#17233a;
  color:#fff;
  font-size:11px;
  font-weight:600;
}
.sheet__undo button { color:#ffd36a; font-weight:800; }
.sheet__title {
  overflow:hidden; font:700 17px var(--font-display);
  color: var(--text);
  text-align:center; text-overflow:ellipsis; white-space:nowrap;
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
.decision-context {
  margin: 0 2px 8px;
}
.nearby-days { display:grid; grid-template-columns:repeat(3, 1fr); gap:5px; }
.nearby-days > div { min-width:0; padding:6px 7px; border-radius:9px; background:#f7f4ed; }
.nearby-days span { display:block; color:var(--text-dim); font-size:9px; font-weight:700; text-transform:uppercase; }
.nearby-days strong { display:block; margin-top:2px; overflow:hidden; color:var(--text-muted); font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
.nearby-day--current { box-shadow:inset 0 0 0 1.5px var(--c-navy); }
.nearby-day--current strong { color:var(--c-navy); }
.anchor-note { margin-top:4px; color:#8a6518; font-size:10.5px; font-weight:600; text-align:center; }
.selected-plan {
  display:grid;
  gap:5px;
  margin:0 2px 8px;
  padding:9px 11px;
  border:1px solid var(--field-border-soft);
  border-radius:13px;
}
.selected-plan > div { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:3px 10px; }
.selected-plan span { color:var(--text-dim); font-size:9px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
.selected-plan strong { grid-column:1; color:var(--text); font-size:12px; }
.selected-plan__controls { grid-column:2; grid-row:1 / span 2; display:flex; align-items:center; gap:2px; }
.selected-plan__controls button { width:20px; height:20px; border-radius:6px; background:#f1f3f7; color:var(--c-navy); font-size:12px; font-weight:800; line-height:1; }
.selected-plan__controls button:disabled { opacity:.35; }
.selected-plan__controls .selected-plan__remove { background:#fff0ee; color:#a04738; font-size:16px; }
.selection-hint { color:var(--text-muted); font-size:10.5px; }
.hopper-button { justify-self:start; padding:7px 10px; border-radius:999px; background:#eef1f7; color:var(--c-navy); font-size:11px; font-weight:700; }
.hopper-button--on { background:var(--c-navy); color:#fff; }
.hopper-hint { color:#9a6c18; font-size:10.5px; }
.auto-advance { display:flex; align-items:center; gap:8px; margin:0 7px 9px; color:var(--text-muted); font-size:11px; }
.auto-advance input { width:16px; height:16px; accent-color:var(--c-navy); }
.activity-search { display:block; margin:0 2px 8px; }
.activity-search input { width:100%; height:36px; padding:0 11px; border:1.5px solid var(--field-border-soft); border-radius:10px; background:#fff; color:var(--text); font:inherit; font-size:13px; }
.activity-search input:focus { border-color:var(--c-navy); outline:2px solid rgba(23,35,58,.12); }
.search-empty { padding:12px 6px; color:var(--text-faint); font-size:12px; }
.sgroup {
  margin-bottom: 9px;
}
.sgroup--used .sgroup__grid { grid-template-columns:repeat(5, 1fr); }
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
  margin: 0 -2px 9px;
  border-top: 1px solid var(--field-border-soft);
}
.accordion {
  border-bottom: 1px solid var(--field-border-soft);
}
.accordion__trigger {
  width: 100%;
  min-height: 42px;
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
  padding: 0 4px 6px;
}
.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 7px 2px;
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

@media (min-width: 900px) {
  .sheet { left:auto; top:0; width:min(460px, 42vw); max-width:none; max-height:none; border-radius:22px 0 0 22px; padding-top:12px; }
  .sheet__handle { display:none; }
  .sheet__head { padding-top:8px; }
}

.sheet-leave-active {
  transition: opacity 0.18s ease;
}
.sheet-leave-to {
  opacity: 0;
}
</style>
