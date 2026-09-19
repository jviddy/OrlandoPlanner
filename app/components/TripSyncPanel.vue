<script setup lang="ts">
import { AnonymousTripRepository, snapshotTrip, type AnonymousCapability, type PersistedTrip } from '~/repositories/tripRepository'
import { migratePersistedTrip } from '~/utils/tripSchema'

const config = useRuntimeConfig()
const store = useTripStore()
const enabled = computed(() => Boolean(config.public.anonymousSyncEnabled))
const accepted = ref(false)
const working = ref(false)
const message = ref('')
const capability = ref<AnonymousCapability | null>(null)
const capabilityKey = computed(() => `orlando-anonymous-capability:${store.tripId}`)
const requestKey = computed(() => `orlando-anonymous-request:${store.tripId}`)
const expiryLabel = computed(() => {
  if (!capability.value?.expiresAt) return ''
  const days = Math.max(0, Math.ceil((Date.parse(capability.value.expiresAt) - Date.now()) / 86_400_000))
  return `${days} day${days === 1 ? '' : 's'}`
})

// Revision conflict state
const conflict = ref(false)
const serverRevision = ref(0)
const serverTrip = ref<PersistedTrip | null>(null)
const conflictDiff = computed(() => {
  if (!serverTrip.value) return []
  const local = snapshotTrip(store.$state)
  const server = serverTrip.value
  const diffs: Array<{ field: string; local: string; server: string }> = []
  const fields: Array<[string, string]> = [
    ['name', 'Trip name'],
    ['startDate', 'Start date'],
    ['endDate', 'End date'],
    ['carHire', 'Car hire'],
    ['confirmationNumber', 'Confirmation'],
    ['bookingPhone', 'Booking phone'],
  ]
  for (const [key, label] of fields) {
    const lv = String((local as any)[key] ?? '')
    const sv = String((server as any)[key] ?? '')
    if (lv !== sv) diffs.push({ field: label, local: lv || '(empty)', server: sv || '(empty)' })
  }
  if (local.days.length !== server.days.length) {
    diffs.push({ field: 'Day count', local: String(local.days.length), server: String(server.days.length) })
  }
  const localItems = local.days.reduce((n: number, d: any) => n + d.items.length, 0)
  const serverItems = server.days.reduce((n: number, d: any) => n + d.items.length, 0)
  if (localItems !== serverItems) {
    diffs.push({ field: 'Total items', local: String(localItems), server: String(serverItems) })
  }
  return diffs
})

onMounted(() => {
  try { capability.value = JSON.parse(localStorage.getItem(capabilityKey.value) ?? 'null') } catch { capability.value = null }
})

function persistCapability(value: AnonymousCapability | null) {
  capability.value = value
  if (value) localStorage.setItem(capabilityKey.value, JSON.stringify(value))
  else localStorage.removeItem(capabilityKey.value)
}
function requestId(): string {
  const existing = localStorage.getItem(requestKey.value)
  if (existing) return existing
  const next = crypto.randomUUID()
  localStorage.setItem(requestKey.value, next)
  return next
}
async function upload() {
  if (!accepted.value) return
  working.value = true; message.value = ''
  try {
    const repository = new AnonymousTripRepository()
    persistCapability(await repository.create(snapshotTrip(store.$state), requestId()))
    message.value = 'Opaque access keys saved on this device. Your local trip remains available.'
  } catch { message.value = 'Upload failed. The local trip is unchanged and can be retried.' }
  working.value = false
}
async function sync() {
  if (!capability.value) return
  working.value = true; message.value = ''; conflict.value = false
  try {
    const repository = new AnonymousTripRepository(capability.value)
    const result = await repository.save(snapshotTrip(store.$state), capability.value.revision)
    persistCapability({ ...capability.value, revision: result.revision, expiresAt: result.expiresAt })
    message.value = `Saved revision ${result.revision}. The local copy is still retained.`
  } catch (err: any) {
    const data = err?.data ?? err?.response?._data
    if (data?.code === 'revision_conflict' && data?.currentRevision) {
      serverRevision.value = data.currentRevision
      await fetchServerVersion()
    } else {
      message.value = 'Sync could not be completed. Review the server version before retrying; the local copy is unchanged.'
    }
  }
  working.value = false
}
async function fetchServerVersion() {
  if (!capability.value) return
  try {
    const repository = new AnonymousTripRepository(capability.value)
    serverTrip.value = await repository.load(store.tripId)
    conflict.value = true
  } catch {
    message.value = 'Could not load the server version. The local copy is unchanged.'
  }
}
async function keepLocal() {
  if (!capability.value) return
  working.value = true; message.value = ''
  try {
    const repository = new AnonymousTripRepository(capability.value)
    const result = await repository.save(snapshotTrip(store.$state), serverRevision.value)
    persistCapability({ ...capability.value, revision: result.revision, expiresAt: result.expiresAt })
    conflict.value = false
    message.value = `Overwrote server with your version (revision ${result.revision}).`
  } catch { message.value = 'Retry failed. The local copy is unchanged.' }
  working.value = false
}
function keepServer() {
  if (!serverTrip.value) return
  Object.assign(store, migratePersistedTrip(serverTrip.value))
  conflict.value = false
  message.value = 'Loaded the server version into your local trip. Sync again to confirm.'
}
function cancelConflict() {
  conflict.value = false
  serverTrip.value = null
  message.value = 'Conflict unresolved. The local copy is unchanged.'
}
async function revoke() {
  if (!capability.value) return
  working.value = true; message.value = ''
  try {
    const repository = new AnonymousTripRepository(capability.value)
    await repository.remove(store.tripId)
    persistCapability(null)
    localStorage.removeItem(requestKey.value)
    message.value = 'Server access revoked. Your local trip remains on this device.'
  } catch { message.value = 'Revocation failed. No local data was removed.' }
  working.value = false
}
</script>

<template>
  <section v-if="enabled" class="sync-panel">
    <p class="group-label">Optional anonymous backup</p>
    <template v-if="!capability">
      <h2>Keep an anonymous server copy</h2>
      <p>No account is created. This sends the current trip to Orlando Planner and stores private edit/view access keys on this device. These keys are opaque, not encrypted, and anyone who obtains one can use its access.</p>
      <label><input v-model="accepted" type="checkbox" /> I understand this uploads a copy and that my local trip will also remain.</label>
      <button type="button" :disabled="!accepted || working" @click="upload">{{ working ? 'Uploading…' : 'Upload anonymous copy' }}</button>
    </template>
    <template v-else-if="conflict">
      <h2>Sync conflict</h2>
      <p>The server has revision {{ serverRevision }} which differs from your local copy. Choose how to resolve this:</p>
      <div v-if="conflictDiff.length" class="conflict-diff">
        <p class="conflict-diff__title">Differences found:</p>
        <table>
          <thead><tr><th>Field</th><th>Your version</th><th>Server version</th></tr></thead>
          <tbody>
            <tr v-for="d in conflictDiff" :key="d.field">
              <td>{{ d.field }}</td>
              <td>{{ d.local }}</td>
              <td>{{ d.server }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="conflict-actions">
        <button type="button" :disabled="working" @click="keepLocal">Keep my version (overwrite server)</button>
        <button type="button" class="sync-panel__server-btn" :disabled="working" @click="keepServer">Use server version</button>
        <button type="button" class="sync-panel__cancel" :disabled="working" @click="cancelConflict">Cancel</button>
      </div>
    </template>
    <template v-else>
      <h2>Anonymous backup connected</h2>
      <p>Server revision {{ capability.revision }}. Sync is manual while this feature is being proven.<template v-if="expiryLabel"> The server copy expires after {{ expiryLabel }} without a successful sync.</template></p>
      <div><button type="button" :disabled="working" @click="sync">Sync now</button><button type="button" class="sync-panel__revoke" :disabled="working" @click="revoke">Revoke server copy</button></div>
    </template>
    <p v-if="message" role="status" class="sync-panel__message">{{ message }}</p>
  </section>
</template>

<style scoped>
.sync-panel{margin:0 20px 22px;padding:15px;border:1px solid var(--warm-border);border-radius:var(--r-card);background:#fff}
.sync-panel h2{margin-top:5px;font-size:17px}
.sync-panel p{margin-top:5px;color:var(--text-muted);font-size:12px;line-height:1.45}
.sync-panel label{display:flex;gap:8px;margin-top:12px;font-size:12px;line-height:1.4}
.sync-panel button{margin-top:12px;padding:9px 12px;border-radius:9px;background:var(--c-navy);color:#fff;font-size:12px;font-weight:700}
.sync-panel div{display:flex;gap:8px}
.sync-panel .sync-panel__revoke{background:#f5e7e3;color:var(--warn-ink)}
.sync-panel .sync-panel__message{padding:8px;border-radius:8px;background:#eef4ef}
.sync-panel .sync-panel__server-btn{background:#e8effb;color:#0b3d91}
.sync-panel .sync-panel__cancel{background:#f0f0f0;color:#555}
.conflict-diff{margin-top:12px}
.conflict-diff__title{font-weight:600;color:var(--text-muted);font-size:12px}
.conflict-diff table{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px}
.conflict-diff th{text-align:left;padding:4px 6px;border-bottom:1px solid var(--warm-border);color:var(--text-muted);font-weight:600}
.conflict-diff td{padding:4px 6px;border-bottom:1px solid #f0f0f0}
.conflict-diff td:nth-child(2){color:var(--c-navy)}
.conflict-diff td:nth-child(3){color:#0f7d74}
.conflict-actions{display:flex;flex-wrap:wrap;gap:8px}
</style>
