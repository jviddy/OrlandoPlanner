<script setup lang="ts">
import { PARKS } from '~/data/parks'
import type { DayItem, ItemKind } from '~/types/trip'

const props = defineProps<{
  kind: ItemKind
  /** Present = editing; absent = adding. */
  item?: DayItem
  /** The park(s) this day is set to (so "another park" excludes them). */
  dayParkId: string | null
  daySecondParkId?: string | null
}>()

const emit = defineEmits<{
  save: [value: Omit<DayItem, 'id'>]
  cancel: []
  remove: []
}>()

const store = useTripStore()
const otherParkOptions = computed(() => [...PARKS, ...store.customActivities])

const title = ref(props.item?.title ?? '')
const time = ref(props.item?.time ?? '')
const state = ref<DayItem['state']>(props.item?.state ?? 'idea')
const otherPark = ref<string>(props.item?.parkId ?? '')

const placeholder = computed(() =>
  props.kind === 'dining'
    ? "e.g. Chef Mickey's, Ohana, Toothsome"
    : 'e.g. Rise of the Resistance LL, Wild Africa Trek',
)

const canSave = computed(() => title.value.trim().length > 0)

const MEAL_PRESETS = [
  { label: 'Breakfast', time: '08:00' },
  { label: 'Lunch', time: '12:30' },
  { label: 'Dinner', time: '18:00' },
]

function submit() {
  if (!canSave.value) return
  emit('save', {
    title: title.value.trim(),
    time: time.value,
    kind: props.kind,
    state: state.value,
    parkId: otherPark.value || null,
  })
}
</script>

<template>
  <form class="iform" @submit.prevent="submit">
    <label class="field">
      <span>{{ kind === 'dining' ? 'What & where' : 'What' }}</span>
      <input
        v-model="title"
        class="input input--sm"
        type="text"
        :placeholder="placeholder"
        autofocus
      />
    </label>

    <div v-if="kind === 'dining'" class="iform__presets">
      <button
        v-for="p in MEAL_PRESETS"
        :key="p.label"
        type="button"
        class="chip"
        :class="{ 'chip--on': time === p.time }"
        @click="time = p.time"
      >
        {{ p.label }}
      </button>
    </div>

    <div class="iform__row">
      <label class="field">
        <span>Time</span>
        <input v-model="time" class="input input--sm" type="time" />
      </label>
      <label class="field">
        <span>Status</span>
        <select v-model="state" class="input input--sm">
          <option value="idea">Idea</option>
          <option value="booked">Booked</option>
        </select>
      </label>
    </div>

    <label class="field">
      <span>Belongs to another park (optional)</span>
      <select v-model="otherPark" class="input input--sm">
        <option value="">Same as this day</option>
        <option
          v-for="p in otherParkOptions"
          :key="p.id"
          :value="p.id"
          :disabled="p.id === dayParkId || p.id === daySecondParkId"
        >
          {{ p.name }}
        </option>
      </select>
    </label>

    <div class="iform__actions">
      <button
        v-if="item"
        type="button"
        class="iform__btn iform__btn--del"
        @click="emit('remove')"
      >
        Delete
      </button>
      <span class="iform__spacer" />
      <button type="button" class="iform__btn" @click="emit('cancel')">
        Cancel
      </button>
      <button type="submit" class="iform__btn iform__btn--save" :disabled="!canSave">
        {{ item ? 'Save' : 'Add' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.iform {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #fff;
  border: 1px solid var(--warm-border);
  border-radius: var(--r-row);
  padding: 13px;
}
.iform__presets {
  display: flex;
  gap: 6px;
}
.chip {
  padding: 7px 12px;
  border-radius: var(--r-pill);
  background: #f2f4f9;
  color: var(--text-muted);
  font-size: 12.5px;
  font-weight: 600;
  border: 1.5px solid transparent;
}
.chip--on {
  background: var(--tile-selected);
  color: var(--c-navy);
  border-color: var(--c-navy);
}
.iform__row {
  /* Stacked by default — a native time input's own intrinsic minimum
     width can still exceed a narrow phone's half-width column even with
     min-width: 0 on the grid item, so side by side only once there's
     room to spare (same breakpoint the app shell itself widens at). */
  display: flex;
  flex-direction: column;
  gap: 10px;
}
@media (min-width: 700px) {
  .iform__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
.iform__row > .field {
  min-width: 0;
}
.iform__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}
.iform__spacer {
  flex: 1;
}
.iform__btn {
  padding: 8px 14px;
  border-radius: var(--r-sheet-tile);
  font-size: 13px;
  font-weight: 600;
  background: #f2f4f9;
  color: var(--text-muted);
}
.iform__btn--save {
  background: var(--c-navy);
  color: #fff;
}
.iform__btn--save:disabled {
  opacity: 0.5;
}
.iform__btn--del {
  background: transparent;
  color: var(--warn-ink);
}
</style>
