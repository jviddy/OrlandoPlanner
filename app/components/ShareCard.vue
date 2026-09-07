<script setup lang="ts">
import { parseISO, useDates } from '~/composables/useDates'

export type ShareMode = 'overview' | 'extended' | 'list'

const props = defineProps<{ mode: ShareMode }>()

const store = useTripStore()
const { dayCell } = useDayCell()
const { dow, time12 } = useDates()
</script>

<template>
  <div class="share-card">
    <header class="share-card__head">
      <p class="share-card__eyebrow">Orlando trip</p>
      <h1 class="share-card__name">{{ store.displayName }}</h1>
      <p class="share-card__range">{{ store.rangeLabel }}</p>
    </header>

    <div v-if="mode === 'overview'" class="share-grid">
      <section v-for="(week, wi) in store.weeks" :key="wi" class="share-week">
        <div class="share-week__row">
          <div
            v-for="(cell, ci) in week.cells"
            :key="ci"
            class="share-cell"
            :class="{ 'share-cell--blank': cell === null }"
          >
            <template v-if="cell !== null">
              <DayCircle
                :park-id="dayCell(cell).parkId"
                :second-park-id="dayCell(cell).secondParkId"
                :date-number="dayCell(cell).dateNumber"
                :size="76"
                flat
              />
              <span class="share-cell__short">{{ dayCell(cell).short || '—' }}</span>
            </template>
          </div>
        </div>
      </section>
    </div>

    <div v-else class="share-rows">
      <div v-for="(day, i) in store.days" :key="day.date" class="share-row">
        <div class="share-row__date">
          <span class="share-row__dow">{{ dow(parseISO(day.date)) }}</span>
          <span class="share-row__num">{{ dayCell(i).dateNumber }}</span>
        </div>
        <DayCircle
          :park-id="dayCell(i).parkId"
          :second-park-id="dayCell(i).secondParkId"
          :size="56"
          flat
        />
        <div class="share-row__body">
          <span class="share-row__park">{{ dayCell(i).short || 'Not set' }}</span>
          <div v-if="mode === 'extended' && day.items.length" class="share-row__items">
            <span v-for="it in day.items" :key="it.id" class="share-row__item">
              {{ it.time ? `${time12(it.time)} — ` : '' }}{{ it.title }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <footer class="share-card__foot">
      <span>{{ store.displayName }} · planned with Orlando Planner</span>
    </footer>
  </div>
</template>

<style scoped>
.share-card {
  width: 1080px;
  height: 1350px;
  background: var(--paper);
  display: flex;
  flex-direction: column;
  padding: 56px 64px;
  font-family: var(--font-ui);
  box-sizing: border-box;
}
.share-card__head {
  flex: none;
  margin-bottom: 40px;
}
.share-card__eyebrow {
  font: 700 20px var(--font-ui);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-faint);
}
.share-card__name {
  font: 700 64px var(--font-display);
  letter-spacing: -0.02em;
  color: var(--text);
  margin-top: 10px;
}
.share-card__range {
  font-size: 26px;
  color: var(--text-muted);
  margin-top: 8px;
}

.share-grid {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 28px;
  overflow: hidden;
}
.share-week__row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}
.share-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 14px 4px;
}
.share-cell--blank {
  visibility: hidden;
}
.share-cell__short {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.2;
}

.share-rows {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}
.share-row {
  flex: none;
  display: flex;
  align-items: center;
  gap: 22px;
  background: #fff;
  border: 1.5px solid var(--warm-border);
  border-radius: 20px;
  padding: 18px 24px;
}
.share-row__date {
  flex: none;
  width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.share-row__dow {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-dim);
}
.share-row__num {
  font: 700 26px var(--font-display);
  color: var(--text);
}
.share-row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.share-row__park {
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
}
.share-row__items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.share-row__item {
  font-size: 18px;
  color: var(--text-muted);
}

.share-card__foot {
  flex: none;
  margin-top: 32px;
  text-align: center;
}
.share-card__foot span {
  font-size: 16px;
  color: var(--text-dim);
}
</style>
