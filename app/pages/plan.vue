<script setup lang="ts">
useHead({ title: 'Plan · Orlando Planner' })

const store = useTripStore()
const route = useRoute()
const router = useRouter()
const selectedIndex = computed(() => store.selectedDay ?? 0)
const selectedDay = computed(() => store.days[selectedIndex.value] ?? null)

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
function openDetails(index: number) {
  const day = store.days[index]
  if (!day) return
  store.selectDay(index)
  navigateTo({ path: '/day', query: { day: day.id } })
}
function nextUnset() {
  const total = store.days.length
  for (let offset = 1; offset <= total; offset++) {
    const index = (selectedIndex.value + offset) % total
    if (!store.days[index]?.parkId) { select(index); return }
  }
}
onMounted(() => {
  if (!store.hasTrip) return navigateTo('/new', { replace: true })
  select(routeIndex())
})
watch(() => route.query.day, () => { if (store.hasTrip) store.selectDay(routeIndex()) })
</script>

<template>
  <div class="screen plan-page">
    <ClientOnly>
      <template v-if="store.hasTrip && selectedDay">
        <header class="plan-head">
          <div class="plan-head__trip">
            <div><p>{{ store.displayName }}</p><span>{{ store.rangeLabel }}</span></div>
            <button v-if="store.unsetDays" type="button" @click="nextUnset">Next unset · {{ store.unsetDays }} left</button>
          </div>
          <TripNav active="plan" />
        </header>
        <PlanDateRail :selected-index="selectedIndex" @select="select" />
        <div class="plan-mobile scroll">
          <PlanDayCard :index="selectedIndex" selected @change="store.openSheet(selectedIndex)" @details="openDetails(selectedIndex)" />
          <div class="plan-mobile__steps">
            <button type="button" :disabled="selectedIndex === 0" @click="select(selectedIndex - 1)">← Previous</button>
            <button type="button" :disabled="selectedIndex === store.days.length - 1" @click="select(selectedIndex + 1)">Next →</button>
          </div>
        </div>
        <div class="plan-board" aria-label="Trip plan board">
          <PlanDayCard v-for="(day, index) in store.days" :key="day.id" :index="index" :selected="index === selectedIndex" @select="select(index)" @change="store.openSheet(index)" @details="openDetails(index)" />
        </div>
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
