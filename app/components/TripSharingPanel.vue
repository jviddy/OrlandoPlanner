<script setup lang="ts">
import { AnonymousTripRepository, snapshotTrip, type AnonymousCapability } from '~/repositories/tripRepository'
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

interface Member {
  id: string
  userId: string
  email: string
  displayName: string
  role: 'owner' | 'agent' | 'editor' | 'viewer'
  createdAt: string
  removable: boolean
}

const store = useTripStore()
const route = useRoute()
const config = useRuntimeConfig()
const { meta, isServerBacked, uploadCurrentTrip } = useServerTrip()
const backed = computed(() => isServerBacked(store.tripId))
const canManage = computed(() => backed.value && Boolean(meta.value?.canManageSharing))
const anonymousSharingEnabled = computed(() => Boolean(config.public.anonymousSyncEnabled))

const capabilities = ref<Capability[]>([])
const invitations = ref<Invitation[]>([])
const members = ref<Member[]>([])
const user = ref<{ id: string; email: string; displayName: string } | null>(null)
const anonymousCapability = ref<AnonymousCapability | null>(null)
const loading = ref(false)
const message = ref('')
const inviteEmail = ref('')
const inviteRole = ref<'editor' | 'viewer'>('viewer')

const temporaryViewUrl = computed(() => anonymousCapability.value
  ? shareUrl(anonymousCapability.value.viewToken)
  : '')

function anonymousCapabilityKey(): string {
  return `orlando-anonymous-capability:${store.tripId}`
}

function loadAnonymousCapability() {
  try {
    anonymousCapability.value = JSON.parse(localStorage.getItem(anonymousCapabilityKey()) ?? 'null')
  } catch {
    anonymousCapability.value = null
  }
}

function persistAnonymousCapability(value: AnonymousCapability | null) {
  anonymousCapability.value = value
  if (value) localStorage.setItem(anonymousCapabilityKey(), JSON.stringify(value))
  else localStorage.removeItem(anonymousCapabilityKey())
}

function anonymousRequestId(): string {
  const key = `orlando-anonymous-request:${store.tripId}`
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const next = crypto.randomUUID()
  localStorage.setItem(key, next)
  return next
}

async function refresh() {
  if (!canManage.value) return
  loading.value = true
  try {
    const [caps, invites, memberResult] = await Promise.all([
      $fetch<{ capabilities: Capability[] }>(`/api/trips/${store.tripId}/capabilities`),
      $fetch<{ invitations: Invitation[] }>(`/api/trips/${store.tripId}/invitations`),
      $fetch<{ members: Member[] }>(`/api/trips/${store.tripId}/members`),
    ])
    capabilities.value = caps.capabilities
    invitations.value = invites.invitations.filter((invite) => !invite.acceptedAt)
    members.value = memberResult.members
  } catch (err: any) {
    message.value = err?.data?.statusMessage || 'Could not load sharing settings.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  loadAnonymousCapability()
  try {
    const session = await $fetch<{ user: typeof user.value }>('/api/auth/session')
    user.value = session.user
  } catch {
    user.value = null
  }
  if (route.query.collaborate === '1' && user.value && !backed.value) {
    const ok = await uploadCurrentTrip()
    if (ok) message.value = 'Trip added to your account. You can now invite editors.'
    await navigateTo('/edit', { replace: true })
  }
  await refresh()
})

function shareUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/trips/${store.tripId}#cap=${encodeURIComponent(token)}`
}

async function createTemporaryViewLink() {
  if (!anonymousSharingEnabled.value) {
    message.value = 'Temporary links are not available right now. Sign in to share a live trip.'
    return
  }
  if (store.confirmationNumber || store.bookingPhone || store.partySize != null) {
    message.value = 'Sign in before sharing a trip containing private booking details.'
    return
  }
  loading.value = true
  message.value = ''
  try {
    const repository = new AnonymousTripRepository()
    const capability = await repository.create(snapshotTrip(store.$state), anonymousRequestId())
    persistAnonymousCapability(capability)
    message.value = 'Temporary view link created. It expires after 180 days without an update.'
  } catch (err: any) {
    message.value = err?.data?.statusMessage || 'Could not create a temporary link. Your local trip is unchanged.'
  } finally {
    loading.value = false
  }
}

async function updateTemporaryViewLink() {
  if (!anonymousCapability.value) return
  loading.value = true
  try {
    const repository = new AnonymousTripRepository(anonymousCapability.value)
    const result = await repository.save(snapshotTrip(store.$state), anonymousCapability.value.revision)
    persistAnonymousCapability({ ...anonymousCapability.value, revision: result.revision, expiresAt: result.expiresAt })
    message.value = 'Temporary shared copy updated.'
  } catch {
    message.value = 'Could not update the shared copy. Your device copy is unchanged.'
  } finally {
    loading.value = false
  }
}

async function startCollaboration() {
  if (!user.value) {
    await navigateTo('/auth/login?redirect=/edit%3Fcollaborate%3D1')
    return
  }
  loading.value = true
  const ok = await uploadCurrentTrip()
  loading.value = false
  if (ok) {
    message.value = 'Trip added to your account. You can now invite editors.'
    await refresh()
  }
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
    message.value = `${kind === 'edit' ? 'Edit' : 'View'} link created. Copy it now; the secret is shown only once.`
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
    capabilities.value = capabilities.value.filter((capability) => capability.id !== id)
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
    const result = await $fetch<{ invitationId: string; email: string; role: 'editor' | 'viewer'; expiresAt: string; devLink?: string }>(`/api/trips/${store.tripId}/invitations`, {
      method: 'POST',
      body: { email: inviteEmail.value, role: inviteRole.value },
    })
    invitations.value.unshift({ id: result.invitationId, email: result.email, role: result.role, expiresAt: result.expiresAt, createdAt: new Date().toISOString(), acceptedAt: null })
    inviteEmail.value = ''
    message.value = `Invitation emailed to ${result.email}.`
    if (result.devLink) {
      await navigator.clipboard.writeText(result.devLink)
      message.value += ' Development invitation link copied.'
    }
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
    invitations.value = invitations.value.filter((invitation) => invitation.id !== id)
    message.value = 'Invitation revoked.'
  } catch (err: any) {
    message.value = err?.data?.statusMessage || 'Could not revoke invitation.'
  } finally {
    loading.value = false
  }
}

async function removeMember(member: Member) {
  if (!canManage.value || !member.removable) return
  loading.value = true
  try {
    await $fetch(`/api/trips/${store.tripId}/members/${member.id}`, { method: 'DELETE' })
    members.value = members.value.filter((entry) => entry.id !== member.id)
    message.value = `${member.displayName || member.email} no longer has access.`
  } catch (err: any) {
    message.value = err?.data?.statusMessage || 'Could not remove this person.'
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
  <section class="sharing-panel">
    <p class="group-label">Sharing</p>

    <template v-if="!backed">
      <div class="sharing-panel__section">
        <div class="sharing-panel__head">
          <strong>Share without an account</strong>
          <span>Trip images stay on this device. A temporary link uploads a view-only copy.</span>
        </div>
        <div v-if="anonymousCapability" class="sharing-panel__temporary">
          <code>{{ temporaryViewUrl }}</code>
          <div class="sharing-panel__actions">
            <button type="button" @click="copy(temporaryViewUrl)">Copy view link</button>
            <button type="button" :disabled="loading" @click="updateTemporaryViewLink">Update shared copy</button>
          </div>
          <small v-if="anonymousCapability.expiresAt">Expires in {{ expiryLabel(anonymousCapability.expiresAt) }} without an update.</small>
        </div>
        <div v-else class="sharing-panel__actions">
          <button type="button" :disabled="loading || !anonymousSharingEnabled" @click="createTemporaryViewLink">Create temporary view link</button>
        </div>
        <p v-if="!anonymousSharingEnabled" class="sharing-panel__empty">Temporary links are currently unavailable. Sign in to share a live trip.</p>
      </div>

      <div class="sharing-panel__section sharing-panel__collaborate">
        <div class="sharing-panel__head">
          <strong>Plan together</strong>
          <span>Claim this trip to an account, then invite named editors with revocable access.</span>
        </div>
        <button type="button" :disabled="loading" @click="startCollaboration">
          {{ user ? 'Add to my account and invite editors' : 'Sign in to invite editors' }}
        </button>
      </div>
    </template>

    <div v-else-if="!canManage" class="sharing-panel__note">
      Only the trip owner or an agent can manage sharing.
    </div>

    <template v-else>
      <div class="sharing-panel__section">
        <div class="sharing-panel__head">
          <strong>Share links</strong>
          <span>View links are convenient and revocable. Named invitations are recommended for editors.</span>
        </div>
        <div class="sharing-panel__actions">
          <button type="button" :disabled="loading" @click="createCapability('view')">Create view link</button>
          <button type="button" class="sharing-panel__secondary" :disabled="loading" @click="createCapability('edit')">Advanced: edit link</button>
        </div>
        <ul v-if="capabilities.length" class="sharing-panel__list">
          <li v-for="capability in capabilities" :key="capability.id">
            <div>
              <span class="sharing-panel__kind">{{ capability.kind }}</span>
              <span class="sharing-panel__expiry">expires in {{ expiryLabel(capability.expiresAt) }}</span>
            </div>
            <div v-if="capability.token" class="sharing-panel__link">
              <code>{{ shareUrl(capability.token) }}</code>
              <button type="button" @click="copy(shareUrl(capability.token))">Copy</button>
              <button type="button" class="sharing-panel__revoke" @click="revokeCapability(capability.id)">Revoke</button>
            </div>
            <div v-else class="sharing-panel__link">
              <span class="sharing-panel__expiry">Secret shown only when the link was created</span>
              <button type="button" class="sharing-panel__revoke" @click="revokeCapability(capability.id)">Revoke</button>
            </div>
          </li>
        </ul>
        <p v-else class="sharing-panel__empty">No active share links.</p>
      </div>

      <div class="sharing-panel__section">
        <div class="sharing-panel__head">
          <strong>Invite by email</strong>
          <span>Editors can change the daily plan. Viewers have read-only access.</span>
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
              <span class="sharing-panel__expiry">{{ invite.role }} · expires in {{ expiryLabel(invite.expiresAt) }}</span>
            </div>
            <button type="button" class="sharing-panel__revoke" @click="revokeInvitation(invite.id)">Revoke</button>
          </li>
        </ul>
        <p v-else class="sharing-panel__empty">No pending invitations.</p>
      </div>

      <div class="sharing-panel__section">
        <div class="sharing-panel__head">
          <strong>People with access</strong>
          <span>Removing someone revokes their account access immediately.</span>
        </div>
        <ul class="sharing-panel__list">
          <li v-for="member in members" :key="member.id" class="sharing-panel__member">
            <div>
              <span class="sharing-panel__kind">{{ member.displayName || member.email }}</span>
              <span class="sharing-panel__expiry">{{ member.email }} · {{ member.role }}</span>
            </div>
            <button v-if="member.removable" type="button" class="sharing-panel__revoke" :disabled="loading" @click="removeMember(member)">Remove</button>
          </li>
        </ul>
      </div>
    </template>

    <p v-if="message" role="status" class="sharing-panel__message">{{ message }}</p>
  </section>
</template>

<style scoped>
.sharing-panel { margin:0 20px 22px; padding:15px; border:1px solid var(--warm-border); border-radius:var(--r-card); background:#fff; }
.sharing-panel__note { font-size:12px; color:var(--text-muted); }
.sharing-panel__section { margin-top:14px; }
.sharing-panel__section:first-of-type { margin-top:0; }
.sharing-panel__head { margin-bottom:10px; }
.sharing-panel__head strong { display:block; font-size:14px; }
.sharing-panel__head span { font-size:12px; color:var(--text-muted); line-height:1.4; }
.sharing-panel__actions { display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap; }
.sharing-panel__actions button,
.sharing-panel__form button,
.sharing-panel__collaborate>button { padding:8px 12px; border-radius:9px; background:var(--c-navy); color:#fff; font-size:12px; font-weight:700; border:none; cursor:pointer; }
.sharing-panel__actions .sharing-panel__secondary { background:#eef0f4; color:var(--text-muted); }
.sharing-panel button:disabled { opacity:.55; cursor:not-allowed; }
.sharing-panel__form { display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap; }
.sharing-panel__form input,
.sharing-panel__form select { padding:8px 10px; border:1px solid var(--field-border); border-radius:8px; font-size:13px; }
.sharing-panel__form input { flex:1; min-width:180px; }
.sharing-panel__list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px; }
.sharing-panel__list li { display:flex; flex-direction:column; gap:6px; padding:10px; border-radius:9px; background:#f7f8fb; }
.sharing-panel__list .sharing-panel__member { flex-direction:row; justify-content:space-between; align-items:center; }
.sharing-panel__kind { font-size:13px; font-weight:700; text-transform:capitalize; margin-right:8px; }
.sharing-panel__expiry { font-size:11px; color:var(--text-muted); }
.sharing-panel__link { display:flex; gap:6px; align-items:center; }
.sharing-panel__link code,
.sharing-panel__temporary code { flex:1; min-width:0; font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; background:#fff; padding:5px 8px; border-radius:6px; border:1px solid var(--field-border-soft); }
.sharing-panel__link button,
.sharing-panel__revoke { padding:5px 8px; border-radius:6px; background:#f1f3f7; color:var(--text-muted); font-size:11px; font-weight:700; border:none; cursor:pointer; }
.sharing-panel__revoke { color:var(--warn-ink); background:#fff0ee; }
.sharing-panel__empty { font-size:12px; color:var(--text-faint); margin:6px 0 0; }
.sharing-panel__message { margin:12px 0 0; padding:8px; border-radius:8px; background:#eef4ef; color:var(--text-muted); font-size:12px; }
.sharing-panel__temporary { padding:10px; border-radius:9px; background:#f7f8fb; }
.sharing-panel__temporary code { display:block; }
.sharing-panel__temporary .sharing-panel__actions { margin:8px 0 4px; }
.sharing-panel__temporary small { color:var(--text-faint); font-size:11px; }
.sharing-panel__collaborate { padding-top:14px; border-top:1px solid var(--warm-border); }
</style>
