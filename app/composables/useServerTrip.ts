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

  async function loadServerTrip(tripId: string): Promise<ServerTrip> {
    const result = await $fetch<{ trip: PersistedTrip; revision: number; role: string; visibility: string }>(`/api/trips/${tripId}`)
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
        headers: { 'If-Match': String(meta.value.revision) },
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
      const result = await $fetch<{ trip: PersistedTrip; revision: number }>(`/api/trips/${meta.value.tripId}`)
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
        headers: { 'If-Match': String(conflict.value.revision) },
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
    loadServerTrip,
    saveServerTrip,
    keepLocal,
    keepServer,
    cancelConflict,
    clearServerLink,
  }
}
