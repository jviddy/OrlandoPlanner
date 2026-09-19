<script setup lang="ts">
import { useServerTrip } from '~/composables/useServerTrip'

const route = useRoute()
const tripId = computed(() => typeof route.params.tripId === 'string' ? route.params.tripId : '')
const dayId = computed(() => typeof route.query.day === 'string' ? route.query.day : '')
const { loadServerTrip } = useServerTrip()

onMounted(async () => {
  if (!tripId.value) {
    navigateTo('/trips', { replace: true })
    return
  }
  try {
    await loadServerTrip(tripId.value)
    const query = dayId.value ? { day: dayId.value } : undefined
    navigateTo({ path: '/day', query }, { replace: true })
  } catch (err: any) {
    const status = err?.statusCode || err?.data?.statusCode
    if (status === 401) {
      const redirect = `/trips/${encodeURIComponent(tripId.value)}/day` + (dayId.value ? `?day=${encodeURIComponent(dayId.value)}` : '')
      navigateTo(`/auth/login?redirect=${encodeURIComponent(redirect)}`, { replace: true })
    } else {
      navigateTo('/trips', { replace: true })
    }
  }
})
</script>

<template>
  <div class="trip-loader">
    <div class="trip-loader__card">
      <h1>Open trip</h1>
      <p>Loading your trip…</p>
    </div>
  </div>
</template>

<style scoped>
.trip-loader {
  min-height: 80vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  background: var(--sand);
}
.trip-loader__card {
  width: 100%;
  max-width: 380px;
  padding: 32px;
  background: #fff;
  border: 1px solid var(--warm-border);
  border-radius: var(--r-card);
}
.trip-loader__card h1 {
  font-size: 22px;
  margin: 0 0 12px;
}
.trip-loader__card p {
  color: var(--text-muted);
  font-size: 13px;
  margin: 0;
}
</style>
