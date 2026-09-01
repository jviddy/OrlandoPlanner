<script setup lang="ts">
import { PARK_BY_ID, SHEET_GROUPS } from '~/data/parks'
import { parseISO, useDates } from '~/composables/useDates'

const store = useTripStore()
const { dayMon } = useDates()

const title = computed(() => {
  const day = store.selected
  return day ? `Set ${dayMon(parseISO(day.date))}` : 'Set the day'
})

function pick(parkId: string) {
  if (store.selectedDay !== null) store.assignDay(store.selectedDay, parkId)
}
function clearDay() {
  if (store.selectedDay !== null) store.clearDay(store.selectedDay)
}
function openDay() {
  store.closeSheet()
  navigateTo('/day')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') store.closeSheet()
}
watch(
  () => store.sheetOpen,
  (open) => {
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
  <Transition name="sheet">
    <div v-if="store.sheetOpen" class="sheet-root">
      <div class="sheet-scrim" @click="store.closeSheet()" />
      <div class="sheet" role="dialog" aria-modal="true" :aria-label="title">
        <div class="sheet__handle" />
        <div class="sheet__head">
          <p class="sheet__title">{{ title }}</p>
          <p class="sheet__sub">
            One tap. Long-press the circle next time to skip straight into the day.
          </p>
        </div>

        <div class="sheet__body">
          <div v-for="group in SHEET_GROUPS" :key="group.title" class="sgroup">
            <p class="sgroup__label">{{ group.title }}</p>
            <div class="sgroup__grid">
              <button
                v-for="pid in group.ids"
                :key="pid"
                type="button"
                class="tile"
                :class="{ 'tile--on': store.selected?.parkId === pid }"
                @click="pick(pid)"
              >
                <DayCircle :park-id="pid" :size="42" />
                <span class="tile__label">{{ PARK_BY_ID[pid]?.short }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="sheet__foot">
          <button type="button" class="sheet__btn sheet__btn--ghost" @click="clearDay">
            Clear day
          </button>
          <button type="button" class="sheet__btn sheet__btn--go" @click="openDay">
            Open day
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sheet-root {
  position: absolute;
  inset: 0;
  z-index: 40;
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
  background: #fff;
  border-radius: 22px 22px 0 0;
  padding: 8px 0 max(26px, env(safe-area-inset-bottom));
  max-height: 78%;
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
  overflow-y: auto;
  padding: 0 14px;
  scrollbar-width: none;
}
.sheet__body::-webkit-scrollbar {
  display: none;
}
.sgroup {
  margin-bottom: 12px;
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
}
.sheet__foot {
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

.sheet-leave-active {
  transition: opacity 0.18s ease;
}
.sheet-leave-to {
  opacity: 0;
}
</style>
