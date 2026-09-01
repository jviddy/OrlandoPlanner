<script setup lang="ts">
import { parkName } from '~/data/parks'
import type { DayItem } from '~/types/trip'

const props = defineProps<{ item: DayItem; dayParkId: string | null }>()
const emit = defineEmits<{ edit: [] }>()

const wrongPark = computed(
  () => props.item.parkId && props.item.parkId !== props.dayParkId,
)
const sub = computed(() => {
  if (wrongPark.value) return `⚠ ${parkName(props.item.parkId)}`
  return props.item.state === 'booked' ? 'Confirmed' : 'Not booked yet'
})
</script>

<template>
  <button type="button" class="irow" @click="emit('edit')">
    <span class="irow__time" :class="{ 'irow__time--empty': !item.time }">
      {{ item.time || '—' }}
    </span>
    <span class="irow__main">
      <span class="irow__title">{{ item.title }}</span>
      <span class="irow__sub" :class="{ 'irow__sub--warn': wrongPark }">{{ sub }}</span>
    </span>
    <span
      class="irow__tag"
      :class="item.state === 'booked' ? 'irow__tag--booked' : 'irow__tag--idea'"
    >
      {{ item.state === 'booked' ? 'Booked' : 'Idea' }}
    </span>
  </button>
</template>

<style scoped>
.irow {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 11px;
  background: #fff;
  border: 1px solid var(--warm-border);
  border-radius: var(--r-row);
  padding: 12px 13px;
  text-align: left;
}
.irow__time {
  flex: none;
  width: 46px;
  font: 700 13px var(--font-ui);
  color: var(--text);
  text-align: center;
}
.irow__time--empty {
  color: #c3c9d6;
}
.irow__main {
  flex: 1;
  min-width: 0;
}
.irow__title {
  display: block;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.25;
}
.irow__sub {
  display: block;
  font-size: 12px;
  color: var(--text-faint);
  margin-top: 2px;
}
.irow__sub--warn {
  color: var(--warn-ink);
}
.irow__tag {
  flex: none;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 3px 7px;
  border-radius: 6px;
}
.irow__tag--booked {
  background: var(--booked-bg);
  color: var(--booked-ink);
}
.irow__tag--idea {
  background: var(--idea-bg);
  color: var(--idea-ink);
}
</style>
