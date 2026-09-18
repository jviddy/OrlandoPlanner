<script setup lang="ts">
import { parseISO, useDates } from '~/composables/useDates'

const props = defineProps<{ selectedIndex: number }>()
const emit = defineEmits<{ select: [index: number] }>()
const store = useTripStore()
const { dowShort } = useDates()
const rail = ref<HTMLElement | null>(null)

function centreSelected() {
  nextTick(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    rail.value?.querySelector<HTMLElement>('[aria-current="date"]')
      ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center' })
  })
}

function moveFocus(index: number) {
  const bounded = Math.max(0, Math.min(store.days.length - 1, index))
  emit('select', bounded)
  nextTick(() => rail.value?.querySelectorAll<HTMLButtonElement>('button')[bounded]?.focus())
}

watch(() => props.selectedIndex, centreSelected)
onMounted(centreSelected)
</script>

<template>
  <div ref="rail" class="date-rail" aria-label="Trip days">
    <button
      v-for="(day, index) in store.days"
      :key="day.id"
      type="button"
      class="date-rail__day"
      :class="{ 'date-rail__day--active': index === selectedIndex }"
      :aria-current="index === selectedIndex ? 'date' : undefined"
      :aria-label="`Day ${index + 1}, ${day.date}`"
      @click="emit('select', index)"
      @keydown.left.prevent="moveFocus(index - 1)"
      @keydown.right.prevent="moveFocus(index + 1)"
      @keydown.home.prevent="moveFocus(0)"
      @keydown.end.prevent="moveFocus(store.days.length - 1)"
    >
      <span>{{ dowShort(parseISO(day.date)) }}</span>
      <strong>{{ parseISO(day.date).getUTCDate() }}</strong>
      <i :class="{ 'date-rail__dot--set': day.parkId }" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.date-rail { display:flex; gap:5px; overflow-x:auto; overscroll-behavior-x:contain; scrollbar-width:none; padding:4px 18px 10px; }
.date-rail::-webkit-scrollbar { display:none; }
.date-rail__day { flex:0 0 54px; min-height:61px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; border:1.5px solid var(--warm-border); border-radius:13px; background:#fff; color:var(--text-muted); }
.date-rail__day span { font-size:9px; font-weight:700; text-transform:uppercase; }
.date-rail__day strong { font:700 18px var(--font-display); color:var(--text); }
.date-rail__day i { width:5px; height:5px; border-radius:50%; background:#d4d7de; }
.date-rail__day--active { border-color:var(--c-navy); background:var(--c-navy); color:#dce4f4; }
.date-rail__day--active strong { color:#fff; }
.date-rail__dot--set { background:#e0a94a !important; }
</style>
