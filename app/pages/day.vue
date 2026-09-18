<script setup lang="ts">
useHead({ title: 'Opening Plan · Orlando Planner' })

const store = useTripStore()
const route = useRoute()

onMounted(() => {
  if (!store.hasTrip) {
    navigateTo('/new', { replace: true })
    return
  }
  const requestedId = typeof route.query.day === 'string' ? route.query.day : ''
  const requestedIndex = store.dayIndexById(requestedId)
  const fallbackIndex = Math.max(0, Math.min(store.selectedDay ?? 0, store.days.length - 1))
  const day = store.days[requestedIndex >= 0 ? requestedIndex : fallbackIndex]
  navigateTo(day ? { path: '/plan', query: { day: day.id } } : '/plan', { replace: true })
})
</script>

<template>
  <div class="screen day-redirect" aria-live="polite">Opening this day in Plan…</div>
</template>

<style scoped>
.day-redirect { display:grid; place-items:center; background:var(--sand); color:var(--text-faint); font-size:13px; }
</style>
