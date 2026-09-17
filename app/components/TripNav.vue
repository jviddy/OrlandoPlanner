<script setup lang="ts">
const props = defineProps<{ active: 'overview' | 'plan' }>()
const store = useTripStore()

const planTo = computed(() => {
  const day = store.days[store.selectedDay ?? 0] ?? store.days[0]
  return day ? { path: '/plan', query: { day: day.id } } : '/plan'
})
</script>

<template>
  <nav class="trip-nav" aria-label="Trip views">
    <NuxtLink to="/" class="trip-nav__item" :class="{ 'trip-nav__item--active': props.active === 'overview' }">
      Overview
    </NuxtLink>
    <NuxtLink :to="planTo" class="trip-nav__item" :class="{ 'trip-nav__item--active': props.active === 'plan' }">
      Plan
    </NuxtLink>
  </nav>
</template>

<style scoped>
.trip-nav { display:grid; grid-template-columns:1fr 1fr; gap:4px; padding:4px; margin-top:10px; border-radius:var(--r-pill); background:#eef0f3; }
.trip-nav__item { min-height:34px; display:grid; place-items:center; border-radius:var(--r-pill); color:var(--text-muted); font-size:13px; font-weight:700; }
.trip-nav__item--active { background:#fff; color:var(--c-navy); box-shadow:0 1px 4px rgb(20 29 48 / 10%); }
</style>
