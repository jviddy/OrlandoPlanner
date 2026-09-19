<script setup lang="ts">
import { capabilityTokenFromLocation, useServerTrip } from '~/composables/useServerTrip'

const route = useRoute()
const tripId = computed(() => typeof route.params.tripId === 'string' ? route.params.tripId : '')
const loading = ref(true)
const error = ref('')

const { loadServerTrip } = useServerTrip()

onMounted(async () => {
  if (!tripId.value) {
    error.value = 'Trip ID is missing.'
    loading.value = false
    return
  }
  try {
    await loadServerTrip(tripId.value, capabilityTokenFromLocation() || undefined)
    navigateTo('/', { replace: true })
  } catch (err: any) {
    const status = err?.statusCode || err?.data?.statusCode
    if (status === 401) {
      navigateTo(`/auth/login?redirect=/trips/${encodeURIComponent(tripId.value)}`, { replace: true })
    } else {
      error.value = err?.data?.statusMessage || 'Could not load this trip.'
      loading.value = false
    }
  }
})
</script>

<template>
  <div class="trip-loader">
    <div class="trip-loader__card">
      <h1>Open trip</h1>
      <p v-if="error" class="trip-loader__error">{{ error }}</p>
      <p v-else>Loading your trip…</p>
      <NuxtLink v-if="error" to="/trips" class="trip-loader__back">← Back to my trips</NuxtLink>
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
.trip-loader__error {
  color: var(--warn-ink);
  font-size: 13px;
  margin: 0 0 16px;
}
.trip-loader__back {
  font-size: 13px;
  color: var(--c-navy);
  text-decoration: none;
}
</style>
