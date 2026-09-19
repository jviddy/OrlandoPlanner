<script setup lang="ts">
import { snapshotTrip } from '~/repositories/tripRepository'
import type { PersistedTrip } from '~/repositories/tripRepository'
import { migratePersistedTrip } from '~/utils/tripSchema'
import { useServerTrip } from '~/composables/useServerTrip'

const store = useTripStore()
const { meta, conflict, saving, message, isServerBacked, saveServerTrip, keepLocal, keepServer, cancelConflict, clearServerLink } = useServerTrip()

const open = ref(false)
const backed = computed(() => isServerBacked(store.tripId))

const conflictDiff = computed(() => {
  if (!conflict.value) return []
  const local = snapshotTrip(store.$state)
  const server = conflict.value.trip
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

async function save() {
  open.value = true
  await saveServerTrip()
}

function useServer() {
  keepServer()
}

async function useLocal() {
  await keepLocal()
}

function close() {
  open.value = false
  if (!conflict.value) cancelConflict()
}
</script>

<template>
  <div v-if="backed" class="server-sync">
    <button type="button" class="server-sync__trigger" aria-label="Save to server" @click="save">
      <AppIcon name="cloud" :size="16" />
    </button>

    <div v-if="open" class="server-sync__panel">
      <div class="server-sync__head">
        <h2>Server copy</h2>
        <button type="button" class="server-sync__close" aria-label="Close" @click="close">×</button>
      </div>

      <template v-if="conflict">
        <p class="server-sync__text">The server has revision {{ conflict.revision }}. Choose how to resolve:</p>
        <div v-if="conflictDiff.length" class="server-sync__diff">
          <table>
            <thead><tr><th>Field</th><th>Yours</th><th>Server</th></tr></thead>
            <tbody>
              <tr v-for="d in conflictDiff" :key="d.field">
                <td>{{ d.field }}</td>
                <td>{{ d.local }}</td>
                <td>{{ d.server }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="server-sync__actions">
          <button type="button" :disabled="saving" @click="useLocal">Keep mine</button>
          <button type="button" class="server-sync__server" :disabled="saving" @click="useServer">Use server</button>
          <button type="button" class="server-sync__cancel" :disabled="saving" @click="cancelConflict">Cancel</button>
        </div>
      </template>

      <template v-else>
        <p class="server-sync__text">
          Linked to server trip. Revision {{ meta?.revision }}.
          <span v-if="meta?.role === 'viewer'" class="server-sync__readonly">(view only)</span>
          <span v-else-if="meta?.role === 'editor'" class="server-sync__readonly">(editor — cannot change trip details)</span>
        </p>
        <div class="server-sync__actions">
          <button type="button" :disabled="saving || meta?.role === 'viewer'" @click="saveServerTrip">
            {{ saving ? 'Saving…' : 'Save now' }}
          </button>
          <button type="button" class="server-sync__cancel" @click="clearServerLink">Unlink</button>
        </div>
      </template>

      <p v-if="message" role="status" class="server-sync__message">{{ message }}</p>
    </div>
  </div>
</template>

<style scoped>
.server-sync {
  position: relative;
}
.server-sync__trigger {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #f2f4f9;
  color: var(--text-muted);
  border: none;
  cursor: pointer;
}
.server-sync__trigger:active {
  transform: scale(0.94);
}
.server-sync__panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: min(320px, calc(100vw - 36px));
  background: #fff;
  border: 1px solid var(--warm-border);
  border-radius: var(--r-card);
  padding: 14px;
  box-shadow: 0 10px 28px #0b142720;
  z-index: 30;
}
.server-sync__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.server-sync__head h2 {
  font: 700 15px/1.2 var(--font-display);
  margin: 0;
}
.server-sync__close {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: #f2f4f9;
  color: var(--text-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.server-sync__text {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.45;
  margin: 0 0 10px;
}
.server-sync__readonly {
  color: var(--warn-ink);
  font-weight: 600;
}
.server-sync__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.server-sync__actions button {
  padding: 7px 12px;
  border-radius: 8px;
  border: none;
  background: var(--c-navy);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.server-sync__actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.server-sync__actions .server-sync__server {
  background: #e8effb;
  color: #0b3d91;
}
.server-sync__actions .server-sync__cancel {
  background: #f0f0f0;
  color: #555;
}
.server-sync__message {
  margin: 10px 0 0;
  padding: 8px;
  border-radius: 8px;
  background: #eef4ef;
  color: var(--text-muted);
  font-size: 12px;
}
.server-sync__diff {
  margin-bottom: 10px;
  overflow-x: auto;
}
.server-sync__diff table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.server-sync__diff th {
  text-align: left;
  padding: 4px 6px;
  border-bottom: 1px solid var(--warm-border);
  color: var(--text-muted);
  font-weight: 600;
}
.server-sync__diff td {
  padding: 4px 6px;
  border-bottom: 1px solid #f0f0f0;
}
.server-sync__diff td:nth-child(2) {
  color: var(--c-navy);
}
.server-sync__diff td:nth-child(3) {
  color: #0f7d74;
}
</style>
