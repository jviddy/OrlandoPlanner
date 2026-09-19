<script setup lang="ts">
import type { PersistedTrip } from '~/repositories/tripRepository'
import { snapshotTrip } from '~/repositories/tripRepository'
import { migratePersistedTrip } from '~/utils/tripSchema'

interface User {
  id: string
  email: string
  displayName: string
  globalRole: string
}

interface ServerTrip {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
  visibility: string
  revision: number
  role: string
  updatedAt: string
}

interface LocalTrip {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  payload: PersistedTrip
}

useHead({ title: 'My trips' })

const router = useRouter()
const store = useTripStore()

const user = ref<User | null>(null)
const serverTrips = ref<ServerTrip[]>([])
const localTrips = ref<LocalTrip[]>([])
const loading = ref(true)
const error = ref('')
const uploadingIds = ref<Set<string>>(new Set())
const deletingIds = ref<Set<string>>(new Set())
const confirmDeleteId = ref<string | null>(null)

onMounted(async () => {
  await loadSession()
  if (!user.value) {
    navigateTo('/auth/login?redirect=/trips', { replace: true })
    return
  }
  await Promise.all([loadServerTrips(), loadLocalTrips()])
  loading.value = false
})

async function loadSession() {
  try {
    const result = await $fetch<{ user: User | null }>('/api/auth/session')
    user.value = result.user
  } catch {
    user.value = null
  }
}

async function loadServerTrips() {
  try {
    const result = await $fetch<{ trips: ServerTrip[] }>('/api/trips')
    serverTrips.value = result.trips
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'Could not load your trips.'
  }
}

function loadLocalTrips() {
  if (typeof window === 'undefined') return
  const prefix = 'orlando-trip-v2:'
  const currentId = window.localStorage.getItem(`${prefix}current`)
  const trips: LocalTrip[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (!key || !key.startsWith(prefix) || key === `${prefix}current`) continue
    const id = key.slice(prefix.length)
    if (!id) continue
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const migrated = migratePersistedTrip(JSON.parse(raw))
      trips.push({
        id,
        name: migrated.name || 'My Trip',
        startDate: migrated.startDate || '',
        endDate: migrated.endDate || '',
        isCurrent: id === currentId,
        payload: migrated,
      })
    } catch {
      // Ignore corrupted local entries
    }
  }
  localTrips.value = trips.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
}

function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return 'No dates set'
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'No dates set'
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const startText = `${start.getUTCDate()} ${months[start.getUTCMonth()]} ${start.getUTCFullYear()}`
  const endText = sameMonth ? `${end.getUTCDate()}` : `${end.getUTCDate()} ${months[end.getUTCMonth()]} ${end.getUTCFullYear()}`
  return `${startText} – ${endText}`
}

async function logout() {
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
  } finally {
    navigateTo('/auth/login', { replace: true })
  }
}

async function uploadLocalTrip(localTrip: LocalTrip) {
  uploadingIds.value.add(localTrip.id)
  error.value = ''
  try {
    const idempotencyKey = `${Date.now()}-${localTrip.id}`
    await $fetch('/api/trips', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: localTrip.payload,
    })
    await loadServerTrips()
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'Upload failed. Try again.'
  } finally {
    uploadingIds.value.delete(localTrip.id)
  }
}

async function createTrip() {
  await navigateTo('/new')
}

function openLocalTrip(id: string) {
  window.localStorage.setItem('orlando-trip-v2:current', id)
  navigateTo('/')
}

function canDelete(role: string): boolean {
  return role === 'owner' || role === 'agent' || role === 'admin'
}

async function deleteTrip(tripId: string) {
  confirmDeleteId.value = null
  deletingIds.value.add(tripId)
  error.value = ''
  try {
    await $fetch(`/api/trips/${tripId}`, { method: 'DELETE' })
    await loadServerTrips()
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'Delete failed. Try again.'
  } finally {
    deletingIds.value.delete(tripId)
  }
}
</script>

<template>
  <div class="trips-page">
    <header class="trips-header">
      <div class="trips-header__main">
        <h1>My trips</h1>
        <p v-if="user" class="trips-email">{{ user.displayName || user.email }}</p>
      </div>
      <div class="trips-header__actions">
        <button type="button" class="trips-btn trips-btn--primary" @click="createTrip">
          New trip
        </button>
        <button type="button" class="trips-btn trips-btn--secondary" @click="logout">
          Sign out
        </button>
      </div>
    </header>

    <main class="trips-body">
      <p v-if="error" class="trips-error">{{ error }}</p>

      <section class="trips-section">
        <h2>Saved trips</h2>
        <div v-if="loading" class="trips-empty">Loading…</div>
        <div v-else-if="serverTrips.length === 0" class="trips-empty">
          No trips saved to your account yet.
        </div>
        <ul v-else class="trips-list">
          <li v-for="trip in serverTrips" :key="trip.id" class="trip-card" :class="{ 'trip-card--link': confirmDeleteId !== trip.id }">
            <NuxtLink v-if="confirmDeleteId !== trip.id" :to="`/trips/${trip.id}`" class="trip-card__info">
              <span class="trip-card__name">{{ trip.name }}</span>
              <span class="trip-card__meta">{{ formatDateRange(trip.startDate, trip.endDate) }} · {{ trip.role }}</span>
            </NuxtLink>
            <div v-else class="trip-card__info">
              <span class="trip-card__name">Delete {{ trip.name }}?</span>
              <span class="trip-card__meta">This cannot be undone.</span>
            </div>
            <div v-if="confirmDeleteId !== trip.id" class="trip-card__actions">
              <span class="trip-card__badge">cloud</span>
              <button
                v-if="canDelete(trip.role)"
                type="button"
                class="trips-btn trips-btn--small trips-btn--danger"
                :disabled="deletingIds.has(trip.id)"
                @click="confirmDeleteId = trip.id"
              >
                Delete
              </button>
            </div>
            <div v-else class="trip-card__actions">
              <button type="button" class="trips-btn trips-btn--small" @click="confirmDeleteId = null">Cancel</button>
              <button
                type="button"
                class="trips-btn trips-btn--small trips-btn--danger"
                :disabled="deletingIds.has(trip.id)"
                @click="deleteTrip(trip.id)"
              >
                {{ deletingIds.has(trip.id) ? 'Deleting…' : 'Confirm delete' }}
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section class="trips-section">
        <h2>On this device</h2>
        <div v-if="localTrips.length === 0" class="trips-empty">
          No local trips found.
        </div>
        <ul v-else class="trips-list">
          <li v-for="trip in localTrips" :key="trip.id" class="trip-card">
            <div class="trip-card__info">
              <span class="trip-card__name">
                {{ trip.name }}
                <span v-if="trip.isCurrent" class="trip-card__current">current</span>
              </span>
              <span class="trip-card__meta">{{ formatDateRange(trip.startDate, trip.endDate) }}</span>
            </div>
            <div class="trip-card__actions">
              <button type="button" class="trips-btn trips-btn--small" @click="openLocalTrip(trip.id)">
                Open
              </button>
              <button
                type="button"
                class="trips-btn trips-btn--small trips-btn--primary"
                :disabled="uploadingIds.has(trip.id)"
                @click="uploadLocalTrip(trip)"
              >
                {{ uploadingIds.has(trip.id) ? 'Saving…' : 'Save to account' }}
              </button>
            </div>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<style scoped>
.trips-page {
  min-height: 100vh;
  background: var(--sand);
  padding: 18px;
}

.trips-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  max-width: 720px;
  margin: 0 auto 24px;
}

.trips-header__main h1 {
  font: 700 24px/1.2 var(--font-display);
  margin: 0;
}

.trips-email {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-muted);
}

.trips-header__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.trips-body {
  max-width: 720px;
  margin: 0 auto;
}

.trips-section {
  margin-bottom: 28px;
}

.trips-section h2 {
  font: 700 15px/1.3 var(--font-display);
  margin: 0 0 10px;
  color: var(--text);
}

.trips-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trip-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid var(--warm-border);
  border-radius: var(--r-card);
}

.trip-card--link {
  padding: 0;
}
.trip-card__info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: inherit;
  text-decoration: none;
  padding: 14px 16px;
  flex: 1;
}

.trip-card__name {
  font-weight: 700;
  font-size: 14px;
  color: var(--text);
}

.trip-card__current {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--c-navy);
  background: #eef3fc;
  padding: 2px 6px;
  border-radius: var(--r-pill);
  margin-left: 6px;
}

.trip-card__meta {
  font-size: 12px;
  color: var(--text-muted);
}

.trip-card__badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--c-navy);
  background: #eef3fc;
  padding: 4px 8px;
  border-radius: var(--r-pill);
}

.trip-card__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.trips-btn {
  padding: 8px 14px;
  border-radius: 9px;
  border: 1px solid var(--warm-border);
  background: #fff;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.trips-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.trips-btn--primary {
  background: var(--c-navy);
  border-color: var(--c-navy);
  color: #fff;
}

.trips-btn--secondary {
  background: transparent;
  border-color: var(--warm-border);
  color: var(--text-muted);
}

.trips-btn--danger {
  background: #fff0ee;
  border-color: #e8c4bc;
  color: var(--warn-ink);
}

.trips-btn--small {
  padding: 6px 10px;
  font-size: 12px;
}

.trips-empty {
  padding: 18px;
  background: #fff;
  border: 1px dashed var(--warm-border);
  border-radius: var(--r-card);
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}

.trips-error {
  margin: 0 0 16px;
  padding: 12px 14px;
  background: var(--warn-bg, #fff0f0);
  color: var(--warn-ink, #c1442f);
  border-radius: var(--r-card);
  font-size: 13px;
}
</style>
