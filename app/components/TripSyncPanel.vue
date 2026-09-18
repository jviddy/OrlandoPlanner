<script setup lang="ts">
import { AnonymousTripRepository, snapshotTrip, type AnonymousCapability } from '~/repositories/tripRepository'

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
  working.value = true; message.value = ''
  try {
    const repository = new AnonymousTripRepository(capability.value)
    const result = await repository.save(snapshotTrip(store.$state), capability.value.revision)
    persistCapability({ ...capability.value, revision: result.revision, expiresAt: result.expiresAt })
    message.value = `Saved revision ${result.revision}. The local copy is still retained.`
  } catch { message.value = 'Sync could not be completed. Review the server version before retrying; the local copy is unchanged.' }
  working.value = false
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
    <template v-else>
      <h2>Anonymous backup connected</h2>
      <p>Server revision {{ capability.revision }}. Sync is manual while this feature is being proven.<template v-if="expiryLabel"> The server copy expires after {{ expiryLabel }} without a successful sync.</template></p>
      <div><button type="button" :disabled="working" @click="sync">Sync now</button><button type="button" class="sync-panel__revoke" :disabled="working" @click="revoke">Revoke server copy</button></div>
    </template>
    <p v-if="message" role="status" class="sync-panel__message">{{ message }}</p>
  </section>
</template>

<style scoped>
.sync-panel{margin:0 20px 22px;padding:15px;border:1px solid var(--warm-border);border-radius:var(--r-card);background:#fff}.sync-panel h2{margin-top:5px;font-size:17px}.sync-panel p{margin-top:5px;color:var(--text-muted);font-size:12px;line-height:1.45}.sync-panel label{display:flex;gap:8px;margin-top:12px;font-size:12px;line-height:1.4}.sync-panel button{margin-top:12px;padding:9px 12px;border-radius:9px;background:var(--c-navy);color:#fff;font-size:12px;font-weight:700}.sync-panel div{display:flex;gap:8px}.sync-panel .sync-panel__revoke{background:#f5e7e3;color:var(--warn-ink)}.sync-panel .sync-panel__message{padding:8px;border-radius:8px;background:#eef4ef}
</style>
