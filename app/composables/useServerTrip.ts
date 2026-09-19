import { migratePersistedTrip } from '~/utils/tripSchema'
import type { PersistedTrip } from '~/repositories/tripRepository'

const SERVER_KEY = 'orlando-trip-v2:server'

export interface ServerTripMeta {
  tripId: string
  revision: number
  role: string
  visibility: string
}

export interface ServerTrip {
  trip: PersistedTrip
  revision: number
  role: string
  visibility: string
}

export interface ConflictInfo {
  revision: number
  trip: PersistedTrip
}

export function useServerTrip() {
  const store = useTripStore()

  const meta = ref<ServerTripMeta | null>(null)
  const conflict = ref<ConflictInfo | null>(null)
  const saving = ref(false)
  const message = ref('')
  const capabilityToken = ref<string | null>(null)

  function setCapabilityToken(token: string | null) {
    capabilityToken.value = token
  }

  function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (capabilityToken.value) headers.Authorization = `Bearer ${capabilityToken.value}`
    return headers
  }

  onMounted(() => {
    loadMeta()
  })

  function loadMeta() {
    if (typeof window === 'undefined') return
    try {
      meta.value = JSON.parse(window.localStorage.getItem(SERVER_KEY) ?? 'null')
    } catch {
      meta.value = null
    }
  }

  function saveMeta(value: ServerTripMeta | null) {
    meta.value = value
    if (typeof window === 'undefined') return
    if (value) window.localStorage.setItem(SERVER_KEY, JSON.stringify(value))
    else window.localStorage.removeItem(SERVER_KEY)
  }

  function isServerBacked(tripId: string): boolean {
    return meta.value?.tripId === tripId
  }

  async function loadServerTrip(tripId: string, token?: string): Promise<ServerTrip> {
    if (token) setCapabilityToken(token)
    const result = await $fetch<{ trip: PersistedTrip; revision: number; role: string; visibility: string }>(`/api/trips/${tripId}`, { headers: authHeaders() })
    store.$reset()
    Object.assign(store, migratePersistedTrip(result.trip))
    window.localStorage.setItem('orlando-trip-v2:current', result.trip.tripId)
    saveMeta({ tripId: result.trip.tripId, revision: result.revision, role: result.role, visibility: result.visibility })
    conflict.value = null
    message.value = ''
    return { trip: result.trip, revision: result.revision, role: result.role, visibility: result.visibility }
  }

  async function saveServerTrip(): Promise<boolean> {
    if (!meta.value) {
      message.value = 'No server trip is linked.'
      return false
    }
    saving.value = true
    message.value = ''
    conflict.value = null
    try {
      const payload = migratePersistedTrip(store.$state)
      const result = await $fetch<{ revision: number }>(`/api/trips/${meta.value.tripId}`, {
        method: 'PUT',
        headers: { 'If-Match': String(meta.value.revision), ...authHeaders() },
        body: payload,
      })
      saveMeta({ ...meta.value, revision: result.revision })
      message.value = `Saved revision ${result.revision}.`
      return true
    } catch (err: any) {
      const data = err?.data ?? err?.response?._data
      if (data?.code === 'revision_conflict' && data?.currentRevision) {
        await fetchServerVersion(data.currentRevision)
      } else {
        message.value = data?.statusMessage || 'Save failed. Your local copy is unchanged.'
      }
      return false
    } finally {
      saving.value = false
    }
  }

  async function fetchServerVersion(revision: number) {
    if (!meta.value) return
    try {
      const result = await $fetch<{ trip: PersistedTrip; revision: number }>(`/api/trips/${meta.value.tripId}`, { headers: authHeaders() })
      conflict.value = { revision, trip: result.trip }
    } catch {
      message.value = 'Could not load the server version. Your local copy is unchanged.'
    }
  }

  async function keepLocal() {
    if (!meta.value || !conflict.value) return false
    saving.value = true
    try {
      const payload = migratePersistedTrip(store.$state)
      const result = await $fetch<{ revision: number }>(`/api/trips/${meta.value.tripId}`, {
        method: 'PUT',
        headers: { 'If-Match': String(conflict.value.revision), ...authHeaders() },
        body: payload,
      })
      saveMeta({ ...meta.value, revision: result.revision })
      conflict.value = null
      message.value = `Overwrote server with your version (revision ${result.revision}).`
      return true
    } catch (err: any) {
      const data = err?.data ?? err?.response?._data
      if (data?.code === 'revision_conflict' && data?.currentRevision) {
        await fetchServerVersion(data.currentRevision)
        message.value = 'Another change happened. Review the conflict again.'
      } else {
        message.value = data?.statusMessage || 'Retry failed. Your local copy is unchanged.'
      }
      return false
    } finally {
      saving.value = false
    }
  }

  function keepServer() {
    if (!conflict.value) return
    Object.assign(store, migratePersistedTrip(conflict.value.trip))
    conflict.value = null
    message.value = 'Loaded the server version. Save again to confirm.'
  }

  function cancelConflict() {
    conflict.value = null
    message.value = 'Conflict unresolved. Your local copy is unchanged.'
  }

  async function uploadCurrentTrip(): Promise<boolean> {
    saving.value = true
    message.value = ''
    try {
      const payload = migratePersistedTrip(store.$state)
      const idempotencyKey = `${Date.now()}-${store.tripId}`
      const result = await $fetch<{ tripId: string; revision: number }>('/api/trips', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: payload,
      })
      saveMeta({ tripId: result.tripId, revision: result.revision, role: 'owner', visibility: 'private' })
      message.value = `Saved to your account as revision ${result.revision}.`
      return true
    } catch (err: any) {
      message.value = err?.data?.statusMessage || 'Save to account failed. Make sure you are signed in.'
      return false
    } finally {
      saving.value = false
    }
  }

  function clearServerLink() {
    saveMeta(null)
    conflict.value = null
    message.value = ''
  }

  return {
    meta: readonly(meta),
    conflict: readonly(conflict),
    saving: readonly(saving),
    message,
    isServerBacked,
    setCapabilityToken,
    loadServerTrip,
    saveServerTrip,
    uploadCurrentTrip,
    keepLocal,
    keepServer,
    cancelConflict,
    clearServerLink,
  }
}
