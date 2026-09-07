<script setup lang="ts">
import { parseISO, useDates } from '~/composables/useDates'

const store = useTripStore()
const { dayCell } = useDayCell()
const { dow } = useDates()

function openDay(index: number) {
  store.selectDay(index)
  navigateTo('/day')
}
</script>

<template>
  <div class="daylist">
    <div v-for="(day, i) in store.days" :key="day.date" class="drow">
      <button type="button" class="drow__main" @click="store.openSheet(i)">
        <span class="drow__date">
          <span class="drow__dow">{{ dow(parseISO(day.date)) }}</span>
          <span class="drow__num">{{ dayCell(i).dateNumber }}</span>
        </span>
        <DayCircle
          :park-id="dayCell(i).parkId"
          :second-park-id="dayCell(i).secondParkId"
          :size="36"
        />
        <span class="drow__info">
          <span class="drow__short">{{ dayCell(i).short || 'Not set' }}</span>
          <span v-if="dayCell(i).hotel" class="drow__hotel">{{ dayCell(i).hotel }}</span>
        </span>
        <span v-if="day.items.length" class="drow__count">
          {{ day.items.length }} planned
        </span>
      </button>
      <button
        type="button"
        class="drow__open"
        aria-label="Open day"
        @click="openDay(i)"
      >
        <AppIcon name="arrowLeft" :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.daylist {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.drow {
  display: flex;
  align-items: stretch;
  gap: 4px;
}
.drow__main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border: 1px solid var(--warm-border);
  border-radius: var(--r-row);
  padding: 10px 13px;
  text-align: left;
}
.drow__date {
  flex: none;
  width: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.drow__dow {
  font-size: 9.5px;
  font-weight: 600;
  color: var(--text-dim);
  letter-spacing: 0.03em;
}
.drow__num {
  font: 700 15px var(--font-display);
  color: var(--text);
}
.drow__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.drow__short {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.drow__hotel {
  font-size: 11.5px;
  color: var(--text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
}
.drow__count {
  flex: none;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-faint);
}
.drow__open {
  flex: none;
  width: 38px;
  display: grid;
  place-items: center;
  background: #fff;
  border: 1px solid var(--warm-border);
  border-radius: var(--r-row);
  color: var(--text-faint);
}
.drow__open :deep(svg) {
  transform: scaleX(-1);
}
</style>
