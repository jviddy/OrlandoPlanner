<script setup lang="ts">
import { TYPE_LABEL } from '~/data/attractions'
import type { ItineraryItem } from '~/types/trip'

const props = defineProps<{
  item: ItineraryItem
  dayIndex: number
  dayCount: number
  isFirst: boolean
  isLast: boolean
}>()

const store = useTripStore()
const { time12, duration } = useFormat()
const open = ref(false)

const typeLabel = computed(() => {
  const t = props.item.type
  if (t === 'break') return 'Break'
  if (t === 'travel') return 'Travel'
  if (t === 'other') return 'Plan'
  return TYPE_LABEL[t] ?? 'Plan'
})

function setTime(e: Event) {
  const value = (e.target as HTMLInputElement).value
  store.updateItem(props.dayIndex, props.item.id, { time: value || undefined })
}
function setDuration(e: Event) {
  const value = Number((e.target as HTMLInputElement).value)
  store.updateItem(props.dayIndex, props.item.id, {
    durationMin: Number.isFinite(value) && value > 0 ? value : undefined,
  })
}
function setNote(e: Event) {
  store.updateItem(props.dayIndex, props.item.id, {
    note: (e.target as HTMLTextAreaElement).value,
  })
}
function moveToDay(e: Event) {
  const to = Number((e.target as HTMLSelectElement).value)
  if (!Number.isNaN(to)) store.moveItemToDay(props.dayIndex, props.item.id, to)
}
</script>

<template>
  <li class="row" :class="{ 'row--done': item.done }">
    <button
      type="button"
      class="row__check"
      :aria-pressed="item.done"
      :title="item.done ? 'Mark as not done' : 'Mark as done'"
      @click="store.toggleItemDone(dayIndex, item.id)"
    >
      <AppIcon v-if="item.done" name="check" :size="14" />
    </button>

    <div class="row__main">
      <div class="row__line">
        <span class="row__title">{{ item.title }}</span>
        <span class="chip row__type">{{ typeLabel }}</span>
      </div>
      <div class="row__sub muted">
        <span v-if="item.time">{{ time12(item.time) }}</span>
        <span v-if="item.durationMin">· {{ duration(item.durationMin) }}</span>
        <span v-if="!item.time && !item.durationMin">No time set</span>
        <span v-if="item.note" class="row__hasnote">· has a note</span>
      </div>
    </div>

    <div class="row__actions">
      <button
        type="button"
        class="btn btn-icon btn-ghost btn-sm"
        :disabled="isFirst"
        title="Move earlier"
        @click="store.nudgeItem(dayIndex, item.id, -1)"
      >
        <AppIcon name="arrowUp" :size="15" />
      </button>
      <button
        type="button"
        class="btn btn-icon btn-ghost btn-sm"
        :disabled="isLast"
        title="Move later"
        @click="store.nudgeItem(dayIndex, item.id, 1)"
      >
        <AppIcon name="arrowDown" :size="15" />
      </button>
      <button
        type="button"
        class="btn btn-icon btn-ghost btn-sm"
        :aria-expanded="open"
        title="Edit details"
        @click="open = !open"
      >
        <AppIcon name="gear" :size="15" />
      </button>
      <button
        type="button"
        class="btn btn-icon btn-ghost btn-sm row__del"
        title="Remove"
        @click="store.removeItem(dayIndex, item.id)"
      >
        <AppIcon name="trash" :size="15" />
      </button>
    </div>

    <div v-if="open" class="row__editor">
      <label class="field">
        <span>Start time</span>
        <input
          class="input"
          type="time"
          :value="item.time ?? ''"
          @change="setTime"
        />
      </label>
      <label class="field">
        <span>Time to allow (min)</span>
        <input
          class="input"
          type="number"
          min="0"
          step="5"
          :value="item.durationMin ?? ''"
          @change="setDuration"
        />
      </label>
      <label v-if="dayCount > 1" class="field">
        <span>Move to</span>
        <select class="select" :value="dayIndex" @change="moveToDay">
          <option v-for="n in dayCount" :key="n" :value="n - 1">
            Day {{ n }}
          </option>
        </select>
      </label>
      <label class="field row__editor-note">
        <span>Note</span>
        <textarea
          class="textarea"
          rows="2"
          :value="item.note ?? ''"
          placeholder="Reminder, reservation number, who's riding…"
          @change="setNote"
        />
      </label>
    </div>
  </li>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px 12px;
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid var(--border);
}
.row:first-child {
  border-top: 0;
}
.row__check {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1.5px solid var(--border-strong);
  background: var(--bg-elev);
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--accent-contrast);
}
.row--done .row__check {
  background: var(--success);
  border-color: var(--success);
}
.row--done .row__title {
  text-decoration: line-through;
  color: var(--text-faint);
}
.row__main {
  min-width: 0;
}
.row__line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.row__title {
  font-weight: 600;
}
.row__type {
  font-size: 0.72rem;
  padding: 2px 8px;
}
.row__sub {
  font-size: 0.82rem;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 2px;
}
.row__hasnote {
  color: var(--warning);
}
.row__actions {
  display: flex;
  gap: 2px;
}
.row__del:hover {
  color: var(--danger);
}
.row__editor {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  padding: 12px;
  background: var(--bg-sunk);
  border-radius: var(--radius-sm);
}
.row__editor-note {
  grid-column: 1 / -1;
}
</style>
