<script setup lang="ts">
import { useServerTrip } from '~/composables/useServerTrip'

interface Capability {
  id: string
  kind: 'view' | 'edit'
  expiresAt: string
  createdAt: string
  token?: string
}

interface Invitation {
  id: string
  email: string
  role: 'editor' | 'viewer'
  expiresAt: string
  createdAt: string
  acceptedAt: string | null
}

const store = useTripStore()
const { meta, isServerBacked } = useServerTrip()
const backed = computed(() => isServerBacked(store.tripId))
const role = computed(() => meta.value?.role ?? '')
const canManage = computed(() => backed.value && (role.value === 'owner' || role.value === 'agent'))

const capabilities = ref<Capability[]>([])
const invitations = ref<Invitation[]>([])
const loading = ref(false)
const message = ref('')
const inviteEmail = ref('')
const inviteRole = ref<'editor' | 'viewer'>('viewer')

async function refresh() {
  if (!canManage.value) return
  loading.value = true
  try {
    const [caps, invites] = await Promise.all([
      $fetch<{ capabilities: Capability[] }>(`/api/trips/${store.tripId}/capabilities`),
      $fetch<{ invitations: Invitation[] }>(`/api/trips/${store.tripId}/invitations`),
    ])
    capabilities.value = caps.capabilities
    invitations.value = invites.invitations
  } catch (err: any) {
    message.value = err?.data?.statusMessage || 'Could not load sharing settings.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refresh()
})

function shareUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/trips/${store.tripId}?cap=${token}`
}

async function createCapability(kind: 'view' | 'edit') {
  if (!canManage.value) return
  loading.value = true
  try {
    const result = await $fetch<{ capabilityId: string; kind: 'view' | 'edit'; token: string; expiresAt: string }>(`/api/trips/${store.tripId}/capabilities`, {
      method: 'POST',
      body: { kind },
    })
    capabilities.value.unshift({ id: result.capabilityId, kind: result.kind, expiresAt: result.expiresAt, createdAt: new Date().toISOString(), token: result.token })
    message.value = `${kind === 'edit' ? 'Edit' : 'View'} link created. Copy it before closing.`
  } catch (err: any) {
    message.value = err?.data?.statusMessage || 'Could not create link.'
  } finally {
    loading.value = false
  }
}

async function revokeCapability(id: string) {
  if (!canManage.value) return
  loading.value = true
  try {
    await $fetch(`/api/trips/${store.tripId}/capabilities/${id}`, { method: 'DELETE' })
    capabilities.value = capabilities.value.filter((c) => c.id !== id)
    message.value = 'Link revoked.'
  } catch (err: any) {
    message.value = err?.data?.statusMessage || 'Could not revoke link.'
  } finally {
    loading.value = false
  }
}

async function sendInvitation() {
  if (!canManage.value || !inviteEmail.value) return
  loading.value = true
  try {
    const result = await $fetch<{ invitationId: string; email: string; role: 'editor' | 'viewer'; token: string; expiresAt: string }>(`/api/trips/${store.tripId}/invitations`, {
      method: 'POST',
      body: { email: inviteEmail.value, role: inviteRole.value },
    })
    invitations.value.unshift({ id: result.invitationId, email: result.email, role: result.role, expiresAt: result.expiresAt, createdAt: new Date().toISOString(), acceptedAt: null })
    inviteEmail.value = ''
    message.value = `Invitation sent to ${result.email}. Accept link copied to clipboard.`
    await navigator.clipboard.writeText(`${window.location.origin}/invitations/${result.token}`)
  } catch (err: any) {
    message.value = err?.data?.statusMessage || 'Could not send invitation.'
  } finally {
    loading.value = false
  }
}

async function revokeInvitation(id: string) {
  if (!canManage.value) return
  loading.value = true
  try {
    await $fetch(`/api/trips/${store.tripId}/invitations/${id}`, { method: 'DELETE' })
    invitations.value = invitations.value.filter((i) => i.id !== id)
    message.value = 'Invitation revoked.'
  } catch (err: any) {
    message.value = err?.data?.statusMessage || 'Could not revoke invitation.'
  } finally {
    loading.value = false
  }
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  message.value = 'Copied to clipboard.'
}

function expiryLabel(iso: string): string {
  const days = Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000))
  return `${days} day${days === 1 ? '' : 's'}`
}
</script>

<template>
  <section v-if="backed" class="sharing-panel">
    <p class="group-label">Sharing</p>

    <div v-if="!canManage" class="sharing-panel__note">
      Only the trip owner or an agent can manage sharing.
    </div>

    <template v-else>
      <div class="sharing-panel__section">
        <div class="sharing-panel__head">
          <strong>Share links</strong>
          <span>Anyone with the link can view or edit without signing in.</span>
        </div>
        <div class="sharing-panel__actions">
          <button type="button" :disabled="loading" @click="createCapability('view')">Create view link</button>
          <button type="button" :disabled="loading" @click="createCapability('edit')">Create edit link</button>
        </div>
        <ul v-if="capabilities.length" class="sharing-panel__list">
          <li v-for="cap in capabilities" :key="cap.id">
            <div>
              <span class="sharing-panel__kind">{{ cap.kind }}</span>
              <span class="sharing-panel__expiry">expires in {{ expiryLabel(cap.expiresAt) }}</span>
            </div>
            <div v-if="cap.token" class="sharing-panel__link">
              <code>{{ shareUrl(cap.token) }}</code>
              <button type="button" @click="copy(shareUrl(cap.token))">Copy</button>
              <button type="button" class="sharing-panel__revoke" @click="revokeCapability(cap.id)">Revoke</button>
            </div>
            <div v-else class="sharing-panel__link">
              <span class="sharing-panel__expiry">Token shown only at creation time</span>
              <button type="button" class="sharing-panel__revoke" @click="revokeCapability(cap.id)">Revoke</button>
            </div>
          </li>
        </ul>
        <p v-else class="sharing-panel__empty">No active share links.</p>
      </div>

      <div class="sharing-panel__section">
        <div class="sharing-panel__head">
          <strong>Invite by email</strong>
          <span>Send a sign-in link to join this trip.</span>
        </div>
        <div class="sharing-panel__form">
          <input v-model="inviteEmail" type="email" placeholder="friend@example.com" />
          <select v-model="inviteRole">
            <option value="viewer">Can view</option>
            <option value="editor">Can edit days</option>
          </select>
          <button type="button" :disabled="loading || !inviteEmail" @click="sendInvitation">Send invite</button>
        </div>
        <ul v-if="invitations.length" class="sharing-panel__list">
          <li v-for="invite in invitations" :key="invite.id">
            <div>
              <span class="sharing-panel__kind">{{ invite.email }}</span>
              <span class="sharing-panel__expiry">{{ invite.role }} · {{ invite.acceptedAt ? 'accepted' : `expires in ${expiryLabel(invite.expiresAt)}` }}</span>
            </div>
            <button v-if="!invite.acceptedAt" type="button" class="sharing-panel__revoke" @click="revokeInvitation(invite.id)">Revoke</button>
          </li>
        </ul>
        <p v-else class="sharing-panel__empty">No pending invitations.</p>
      </div>

      <p v-if="message" role="status" class="sharing-panel__message">{{ message }}</p>
    </template>
  </section>
</template>

<style scoped>
.sharing-panel {
  margin: 0 20px 22px;
  padding: 15px;
  border: 1px solid var(--warm-border);
  border-radius: var(--r-card);
  background: #fff;
}
.sharing-panel__note {
  font-size: 12px;
  color: var(--text-muted);
}
.sharing-panel__section {
  margin-top: 14px;
}
.sharing-panel__section:first-child {
  margin-top: 0;
}
.sharing-panel__head {
  margin-bottom: 10px;
}
.sharing-panel__head strong {
  display: block;
  font-size: 14px;
}
.sharing-panel__head span {
  font-size: 12px;
  color: var(--text-muted);
}
.sharing-panel__actions {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.sharing-panel__actions button,
.sharing-panel__form button {
  padding: 8px 12px;
  border-radius: 9px;
  background: var(--c-navy);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  border: none;
  cursor: pointer;
}
.sharing-panel__actions button:disabled,
.sharing-panel__form button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.sharing-panel__form {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.sharing-panel__form input,
.sharing-panel__form select {
  padding: 8px 10px;
  border: 1px solid var(--field-border);
  border-radius: 8px;
  font-size: 13px;
}
.sharing-panel__form input {
  flex: 1;
  min-width: 180px;
}
.sharing-panel__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sharing-panel__list li {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: 9px;
  background: #f7f8fb;
}
.sharing-panel__kind {
  font-size: 13px;
  font-weight: 700;
  text-transform: capitalize;
  margin-right: 8px;
}
.sharing-panel__expiry {
  font-size: 11px;
  color: var(--text-muted);
}
.sharing-panel__link {
  display: flex;
  gap: 6px;
  align-items: center;
}
.sharing-panel__link code {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #fff;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid var(--field-border-soft);
}
.sharing-panel__link button,
.sharing-panel__revoke {
  padding: 5px 8px;
  border-radius: 6px;
  background: #f1f3f7;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  border: none;
  cursor: pointer;
}
.sharing-panel__revoke {
  color: var(--warn-ink);
  background: #fff0ee;
}
.sharing-panel__empty {
  font-size: 12px;
  color: var(--text-faint);
  margin: 6px 0 0;
}
.sharing-panel__message {
  margin: 12px 0 0;
  padding: 8px;
  border-radius: 8px;
  background: #eef4ef;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
