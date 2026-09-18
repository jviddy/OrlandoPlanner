<script setup lang="ts">
useHead({ title: 'Plan · Orlando Planner' })

const store = useTripStore()
const route = useRoute()
const router = useRouter()
const selectedIndex = computed(() => store.selectedDay ?? 0)
const selectedDay = computed(() => store.days[selectedIndex.value] ?? null)
const board = ref<HTMLElement | null>(null)
const detailEditor = ref<{ index: number; action: 'booking' | 'idea' | 'edit' } | null>(null)
const nextUnsetIndex = computed(() => {
  for (let offset = 1; offset < store.days.length; offset++) {
    const index = (selectedIndex.value + offset) % store.days.length
    if (!store.days[index]?.parkId) return index
  }
  return -1
})

function routeIndex(): number {
  const id = typeof route.query.day === 'string' ? route.query.day : ''
  const found = store.dayIndexById(id)
  return found >= 0 ? found : Math.max(0, Math.min(store.selectedDay ?? 0, store.days.length - 1))
}
function select(index: number) {
  const day = store.days[index]
  if (!day) return
  store.selectDay(index)
  router.replace({ path: '/plan', query: { day: day.id } })
}
function openDetails(index: number, action: 'booking' | 'idea' | 'edit' = 'edit') {
  if (!store.days[index]) return
  store.selectDay(index)
  detailEditor.value = { index, action }
}
function changeFromDetails(index: number) {
  detailEditor.value = null
  nextTick(() => store.openSheet(index))
}
function nextUnset() {
  if (nextUnsetIndex.value >= 0) select(nextUnsetIndex.value)
}
function scrollBoardToSelected() {
  nextTick(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    board.value?.querySelector<HTMLElement>('.plan-card--selected')
      ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center' })
  })
}
function onPlanKeydown(event: KeyboardEvent) {
  if (store.sheetOpen || event.altKey || event.ctrlKey || event.metaKey) return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return
  if (event.key === 'ArrowLeft' && selectedIndex.value > 0) {
    event.preventDefault()
    select(selectedIndex.value - 1)
  } else if (event.key === 'ArrowRight' && selectedIndex.value < store.days.length - 1) {
    event.preventDefault()
    select(selectedIndex.value + 1)
  }
}
onMounted(() => {
  if (!store.hasTrip) return navigateTo('/new', { replace: true })
  select(routeIndex())
  window.addEventListener('keydown', onPlanKeydown)
})
watch(() => route.query.day, () => { if (store.hasTrip) store.selectDay(routeIndex()) })
watch(selectedIndex, scrollBoardToSelected)
onBeforeUnmount(() => window.removeEventListener('keydown', onPlanKeydown))
</script>

<template>
  <div class="screen plan-page">
    <ClientOnly>
      <template v-if="store.hasTrip && selectedDay">
        <header class="plan-head">
          <div class="plan-head__trip">
            <div><p>{{ store.displayName }}</p><span>{{ store.rangeLabel }}</span></div>
            <div class="plan-head__actions">
              <NuxtLink to="/templates?reapply=1&return=plan">Starting shape</NuxtLink>
              <button v-if="nextUnsetIndex >= 0" type="button" @click="nextUnset">Next unset · {{ store.unsetDays }} left</button>
            </div>
          </div>
          <TripNav active="plan" />
        </header>
        <PlanDateRail :selected-index="selectedIndex" @select="select" />
        <div class="plan-mobile scroll">
          <PlanDayCard :index="selectedIndex" selected @change="store.openSheet(selectedIndex)" @add-booking="openDetails(selectedIndex, 'booking')" @add-idea="openDetails(selectedIndex, 'idea')" @edit-details="openDetails(selectedIndex)" />
          <div class="plan-mobile__steps">
            <button type="button" :disabled="selectedIndex === 0" @click="select(selectedIndex - 1)">← Previous</button>
            <button type="button" :disabled="selectedIndex === store.days.length - 1" @click="select(selectedIndex + 1)">Next →</button>
          </div>
        </div>
        <div ref="board" class="plan-board" aria-label="Trip plan board">
          <PlanDayCard v-for="(day, index) in store.days" :key="day.id" :index="index" :selected="index === selectedIndex" @select="select(index)" @change="store.openSheet(index)" @add-booking="openDetails(index, 'booking')" @add-idea="openDetails(index, 'idea')" @edit-details="openDetails(index)" />
        </div>
        <PlanDetailsSheet v-if="detailEditor" :index="detailEditor.index" :initial-action="detailEditor.action" @close="detailEditor = null" @change-day="changeFromDetails(detailEditor.index)" />
      </template>
      <div v-else class="plan-loading" />
      <template #fallback><div class="plan-loading" /></template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.plan-page { background:var(--sand); }
.plan-loading { flex:1; background:var(--sand); }
.plan-head { flex:none; padding:10px 18px 8px; background:var(--paper); border-bottom:1px solid var(--warm-rule); }
.plan-head__trip { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.plan-head__trip p { font:700 20px/1.1 var(--font-display); color:var(--text); }
.plan-head__trip span { display:block; margin-top:3px; color:var(--text-faint); font-size:11.5px; }
.plan-head__actions { display:flex; align-items:center; gap:8px; }
.plan-head__actions a { color:var(--c-navy); font-size:11px; font-weight:700; }
.plan-head__trip button { flex:none; padding:8px 10px; border-radius:var(--r-pill); background:var(--c-navy); color:#fff; font-size:11px; font-weight:700; }
.plan-mobile { padding:4px 14px 90px; }
.plan-mobile :deep(.plan-card) { margin-inline:auto; }
.plan-mobile__steps { display:flex; justify-content:space-between; gap:10px; width:min(100%, 420px); margin:12px auto 0; }
.plan-mobile__steps button { padding:10px; color:var(--c-navy); font-size:12px; font-weight:700; }
.plan-mobile__steps button:disabled { color:var(--text-dim); }
.plan-board { display:none; }
@media (min-width:760px) {
  .plan-page { max-width:none; }
  .plan-head { padding-inline:max(24px, calc((100vw - 1180px) / 2)); }
  .plan-head :deep(.trip-nav) { max-width:360px; }
  .plan-page :deep(.date-rail) { padding-inline:max(24px, calc((100vw - 1180px) / 2)); }
  .plan-mobile { display:none; }
  .plan-board { flex:1; min-height:0; display:flex; gap:14px; overflow-x:auto; overflow-y:hidden; scroll-snap-type:x proximity; overscroll-behavior-x:contain; padding:8px max(24px, calc((100vw - 1180px) / 2)) 28px; }
  .plan-board :deep(.plan-card) { flex:0 0 340px; scroll-snap-align:start; overflow-y:auto; }
}
</style>
