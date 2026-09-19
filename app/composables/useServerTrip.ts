import { migratePersistedTrip } from '~/utils/tripSchema'
import type { PersistedTrip } from '~/repositories/tripRepository'

const SERVER_KEY = 'orlando-trip-v2:server'
const CAPABILITY_KEY = 'orlando-trip-v2:capability:'
const PENDING_KEY = 'orlando-trip-v2:pending:'
const AUTOSAVE_DELAY = 1_200

export type TripSyncStatus = 'device' | 'saving' | 'saved' | 'offline' | 'error' | 'readonly' | 'conflict'

export interface ServerTripMeta {
  tripId: string
  revision: number
  role: string
  visibility: string
  canEdit: boolean
  canManageSharing: boolean
}

export interface ServerTrip {
  trip: PersistedTrip
  revision: number
  role: string
  visibility: string
  canEdit: boolean
  canManageSharing: boolean
}

export interface ConflictInfo {
  revision: number
  trip: PersistedTrip
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null
let browserListenersReady = false

function inferCanEdit(role: string): boolean {
  return role === 'owner' || role === 'agent' || role === 'editor'
}

function normalizeMeta(value: Partial<ServerTripMeta> | null): ServerTripMeta | null {
  if (!value?.tripId || !Number.isInteger(value.revision)) return null
  const role = String(value.role || 'viewer')
  return {
    tripId: value.tripId,
    revision: Number(value.revision),
    role,
    visibility: String(value.visibility || 'private'),
    canEdit: value.canEdit ?? inferCanEdit(role),
    canManageSharing: value.canManageSharing ?? (role === 'owner' || role === 'agent'),
  }
}

/** Capability secrets live in the fragment so they are not sent in referrers or routine server logs. */
export function capabilityTokenFromLocation(): string {
  if (typeof window === 'undefined' || !window.location.hash) return ''
  const params = new URLSearchParams(window.location.hash.slice(1))
  return params.get('cap') || params.get('capability') || ''
}

export function useServerTrip() {
  const store = useTripStore()
  const meta = useState<ServerTripMeta | null>('server-trip:meta', () => null)
  const conflict = useState<ConflictInfo | null>('server-trip:conflict', () => null)
  const saving = useState<boolean>('server-trip:saving', () => false)
  const message = useState<string>('server-trip:message', () => '')
  const capabilityToken = useState<string | null>('server-trip:capability', () => null)
  const syncStatus = useState<TripSyncStatus>('server-trip:status', () => 'device')
  const initialized = useState<boolean>('server-trip:initialized', () => false)
  const applyingRemote = useState<boolean>('server-trip:applying-remote', () => false)
  const saveQueued = useState<boolean>('server-trip:save-queued', () => false)
  const lastSavedSnapshot = useState<string>('server-trip:last-snapshot', () => '')

  function persistedSnapshot(): string {
    return JSON.stringify(migratePersistedTrip(store.$state))
  }

  function pendingKey(tripId: string): string {
    return `${PENDING_KEY}${tripId}`
  }

  function setCapabilityToken(token: string | null, tripId = meta.value?.tripId ?? store.tripId) {
    capabilityToken.value = token
    if (typeof window === 'undefined' || !tripId) return
    if (token) window.sessionStorage.setItem(`${CAPABILITY_KEY}${tripId}`, token)
    else window.sessionStorage.removeItem(`${CAPABILITY_KEY}${tripId}`)
  }

  function authHeaders(): Record<string, string> {
    return capabilityToken.value ? { Authorization: `Bearer ${capabilityToken.value}` } : {}
  }

  function loadMeta() {
    if (typeof window === 'undefined') return
    try {
      meta.value = normalizeMeta(JSON.parse(window.localStorage.getItem(SERVER_KEY) ?? 'null'))
    } catch {
      meta.value = null
    }
    if (meta.value) {
      capabilityToken.value = window.sessionStorage.getItem(`${CAPABILITY_KEY}${meta.value.tripId}`)
      syncStatus.value = meta.value.canEdit ? 'saved' : 'readonly'
    } else {
      syncStatus.value = 'device'
    }
  }

  function saveMeta(value: ServerTripMeta | null) {
    meta.value = value
    if (typeof window === 'undefined') return
    if (value) window.localStorage.setItem(SERVER_KEY, JSON.stringify(value))
    else window.localStorage.removeItem(SERVER_KEY)
  }

  async function initialize() {
    if (initialized.value || typeof window === 'undefined') return
    loadMeta()
    if (meta.value?.tripId === store.tripId && !window.localStorage.getItem(pendingKey(store.tripId))) {
      lastSavedSnapshot.value = persistedSnapshot()
    }
    initialized.value = true
    if (!browserListenersReady) {
      browserListenersReady = true
      window.addEventListener('online', () => {
        if (meta.value?.canEdit && meta.value.tripId === store.tripId) scheduleAutoSave(0)
      })
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && meta.value?.canEdit && meta.value.tripId === store.tripId) {
          void flushAutoSave()
        }
      })
    }
  }

  function isServerBacked(tripId: string): boolean {
    return meta.value?.tripId === tripId
  }

  async function loadServerTrip(tripId: string, suppliedToken?: string): Promise<ServerTrip> {
    await initialize()
    const token = suppliedToken || capabilityTokenFromLocation() || window.sessionStorage.getItem(`${CAPABILITY_KEY}${tripId}`) || ''
    if (token) setCapabilityToken(token, tripId)
    else capabilityToken.value = null
    const result = await $fetch<ServerTrip>(`/api/trips/${tripId}`, { headers: authHeaders() })
    applyingRemote.value = true
    try {
      store.$reset()
      Object.assign(store, migratePersistedTrip(result.trip))
      window.localStorage.setItem('orlando-trip-v2:current', result.trip.tripId)
    } finally {
      await nextTick()
      applyingRemote.value = false
    }
    saveMeta({
      tripId: result.trip.tripId,
      revision: result.revision,
      role: result.role,
      visibility: result.visibility,
      canEdit: result.canEdit,
      canManageSharing: result.canManageSharing,
    })
    lastSavedSnapshot.value = JSON.stringify(migratePersistedTrip(result.trip))
    window.localStorage.removeItem(pendingKey(result.trip.tripId))
    conflict.value = null
    message.value = ''
    syncStatus.value = result.canEdit ? 'saved' : 'readonly'
    return result
  }

  async function saveServerTrip(): Promise<boolean> {
    if (!meta.value || meta.value.tripId !== store.tripId) {
      message.value = 'This trip is saved on this device only.'
      syncStatus.value = 'device'
      return false
    }
    if (!meta.value.canEdit) {
      syncStatus.value = 'readonly'
      return false
    }
    if (saving.value) {
      saveQueued.value = true
      return false
    }

    const snapshot = persistedSnapshot()
    if (snapshot === lastSavedSnapshot.value && !conflict.value) {
      window.localStorage.removeItem(pendingKey(store.tripId))
      syncStatus.value = 'saved'
      return true
    }

    saving.value = true
    syncStatus.value = 'saving'
    message.value = ''
    conflict.value = null
    try {
      const payload = JSON.parse(snapshot) as PersistedTrip
      const result = await $fetch<{ revision: number }>(`/api/trips/${meta.value.tripId}`, {
        method: 'PUT',
        headers: { 'If-Match': String(meta.value.revision), ...authHeaders() },
        body: payload,
      })
      saveMeta({ ...meta.value, revision: result.revision })
      lastSavedSnapshot.value = snapshot
      window.localStorage.removeItem(pendingKey(store.tripId))
      syncStatus.value = 'saved'
      message.value = 'All changes saved to your account.'
      return true
    } catch (err: any) {
      const data = err?.data ?? err?.response?._data
      if (data?.code === 'revision_conflict' && data?.currentRevision) {
        await fetchServerVersion(data.currentRevision)
        syncStatus.value = 'conflict'
      } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
        syncStatus.value = 'offline'
        message.value = 'Offline. Your changes are safe on this device and will sync when you reconnect.'
      } else {
        syncStatus.value = 'error'
        message.value = data?.statusMessage || 'Cloud save failed. Your changes remain safe on this device.'
      }
      return false
    } finally {
      saving.value = false
      if (saveQueued.value) {
        saveQueued.value = false
        scheduleAutoSave(0)
      }
    }
  }

  function scheduleAutoSave(delay = AUTOSAVE_DELAY) {
    if (typeof window === 'undefined' || applyingRemote.value) return
    if (!meta.value || meta.value.tripId !== store.tripId || !meta.value.canEdit) return
    const snapshot = persistedSnapshot()
    if (snapshot === lastSavedSnapshot.value) return
    window.localStorage.setItem(pendingKey(store.tripId), '1')
    syncStatus.value = navigator.onLine ? 'saving' : 'offline'
    if (autosaveTimer) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => { void flushAutoSave() }, delay)
  }

  async function flushAutoSave(): Promise<boolean> {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer)
      autosaveTimer = null
    }
    return await saveServerTrip()
  }

  function resumePendingSave() {
    if (typeof window === 'undefined' || !meta.value || meta.value.tripId !== store.tripId) return
    if (window.localStorage.getItem(pendingKey(store.tripId))) scheduleAutoSave(0)
  }

  async function fetchServerVersion(revision: number) {
    if (!meta.value) return
    try {
      const result = await $fetch<{ trip: PersistedTrip; revision: number }>(`/api/trips/${meta.value.tripId}`, { headers: authHeaders() })
      conflict.value = { revision, trip: result.trip }
      message.value = 'This trip was changed somewhere else. Choose which version to keep.'
    } catch {
      syncStatus.value = 'error'
      message.value = 'Could not load the cloud version. Your local copy is unchanged.'
    }
  }

  async function keepLocal() {
    if (!meta.value || !conflict.value) return false
    saving.value = true
    syncStatus.value = 'saving'
    const snapshot = persistedSnapshot()
    try {
      const result = await $fetch<{ revision: number }>(`/api/trips/${meta.value.tripId}`, {
        method: 'PUT',
        headers: { 'If-Match': String(conflict.value.revision), ...authHeaders() },
        body: JSON.parse(snapshot),
      })
      saveMeta({ ...meta.value, revision: result.revision })
      lastSavedSnapshot.value = snapshot
      window.localStorage.removeItem(pendingKey(store.tripId))
      conflict.value = null
      syncStatus.value = 'saved'
      message.value = 'Your version is now saved to the cloud.'
      return true
    } catch (err: any) {
      const data = err?.data ?? err?.response?._data
      if (data?.code === 'revision_conflict' && data?.currentRevision) await fetchServerVersion(data.currentRevision)
      else message.value = data?.statusMessage || 'Retry failed. Your local copy is unchanged.'
      syncStatus.value = conflict.value ? 'conflict' : 'error'
      return false
    } finally {
      saving.value = false
    }
  }

  function keepServer() {
    if (!conflict.value || !meta.value) return
    applyingRemote.value = true
    Object.assign(store, migratePersistedTrip(conflict.value.trip))
    saveMeta({ ...meta.value, revision: conflict.value.revision })
    lastSavedSnapshot.value = JSON.stringify(migratePersistedTrip(conflict.value.trip))
    window.localStorage.removeItem(pendingKey(store.tripId))
    conflict.value = null
    syncStatus.value = 'saved'
    message.value = 'The cloud version is now open.'
    nextTick(() => { applyingRemote.value = false })
  }

  function cancelConflict() {
    conflict.value = null
    syncStatus.value = 'error'
    message.value = 'The conflict is unresolved. Your local copy remains safe.'
  }

  async function claimAnonymousTrip(editToken: string): Promise<boolean> {
    const tokenResult = await $fetch<{ claimToken: string }>(`/api/trips/${store.tripId}/claim-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${editToken}` },
    })
    const result = await $fetch<{ tripId: string; revision: number; role: string }>(`/api/trips/${store.tripId}/claim`, {
      method: 'POST',
      body: { claimToken: tokenResult.claimToken },
    })
    saveMeta({ tripId: result.tripId, revision: result.revision, role: 'owner', visibility: 'private', canEdit: true, canManageSharing: true })
    lastSavedSnapshot.value = persistedSnapshot()
    localStorage.removeItem(`orlando-anonymous-capability:${store.tripId}`)
    localStorage.removeItem(`orlando-anonymous-request:${store.tripId}`)
    syncStatus.value = 'saved'
    message.value = 'Trip added to your account. Future changes save automatically.'
    return true
  }

  async function uploadCurrentTrip(): Promise<boolean> {
    await initialize()
    if (meta.value?.tripId === store.tripId) return true
    saving.value = true
    syncStatus.value = 'saving'
    message.value = ''
    try {
      const payload = migratePersistedTrip(store.$state)
      const idempotencyKey = `${Date.now()}-${store.tripId}`
      const result = await $fetch<{ tripId: string; revision: number }>('/api/trips', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: payload,
      })
      saveMeta({ tripId: result.tripId, revision: result.revision, role: 'owner', visibility: 'private', canEdit: true, canManageSharing: true })
      lastSavedSnapshot.value = JSON.stringify(payload)
      window.localStorage.removeItem(pendingKey(store.tripId))
      syncStatus.value = 'saved'
      message.value = 'Trip added to your account. Future changes save automatically.'
      return true
    } catch (err: any) {
      const data = err?.data ?? err?.response?._data
      if (data?.code === 'trip_requires_claim') {
        try {
          const capability = JSON.parse(localStorage.getItem(`orlando-anonymous-capability:${store.tripId}`) ?? 'null')
          if (capability?.editToken) return await claimAnonymousTrip(capability.editToken)
        } catch { /* fall through to the recovery message */ }
      }
      syncStatus.value = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error'
      message.value = data?.statusMessage || 'Could not add this trip to your account. It remains safe on this device.'
      return false
    } finally {
      saving.value = false
    }
  }

  async function ensureOwnedTripIfSignedIn(): Promise<boolean> {
    try {
      const session = await $fetch<{ user: { id: string } | null }>('/api/auth/session')
      if (!session.user) return false
      return await uploadCurrentTrip()
    } catch {
      return false
    }
  }

  function clearServerLink() {
    if (meta.value?.tripId) {
      window.localStorage.removeItem(pendingKey(meta.value.tripId))
      setCapabilityToken(null, meta.value.tripId)
    }
    saveMeta(null)
    conflict.value = null
    lastSavedSnapshot.value = ''
    syncStatus.value = 'device'
    message.value = ''
  }

  return {
    meta: readonly(meta),
    conflict: readonly(conflict),
    saving: readonly(saving),
    syncStatus: readonly(syncStatus),
    message,
    initialize,
    isServerBacked,
    setCapabilityToken,
    loadServerTrip,
    saveServerTrip,
    scheduleAutoSave,
    flushAutoSave,
    resumePendingSave,
    uploadCurrentTrip,
    ensureOwnedTripIfSignedIn,
    keepLocal,
    keepServer,
    cancelConflict,
    clearServerLink,
  }
}
