<script setup lang="ts">
import { useServerTrip } from '~/composables/useServerTrip'

const store = useTripStore()
const route = useRoute()
const menuOpen = ref(false)
const user = ref<{ id: string; email: string; displayName: string } | null>(null)
const loadingUser = ref(false)

const { meta, saving, message, isServerBacked, uploadCurrentTrip, clearServerLink } = useServerTrip()

const backed = computed(() => isServerBacked(store.tripId))
const hasTrip = computed(() => store.hasTrip)
const isHome = computed(() => route.path === '/')
const isTrips = computed(() => route.path === '/trips')

async function refreshUser() {
  loadingUser.value = true
  try {
    const session = await $fetch<{ user: { id: string; email: string; displayName: string } | null }>('/api/auth/session')
    user.value = session.user
  } catch {
    user.value = null
  }
  loadingUser.value = false
}

onMounted(() => {
  refreshUser()
})

async function saveCurrentTrip() {
  await uploadCurrentTrip()
  menuOpen.value = false
}

async function logout() {
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
  } finally {
    user.value = null
    clearServerLink()
    menuOpen.value = false
    navigateTo('/auth/login', { replace: true })
  }
}

function closeMenu() {
  menuOpen.value = false
}
</script>

<template>
  <header class="app-header">
    <button type="button" class="app-header__menu-btn" aria-label="Menu" @click="menuOpen = !menuOpen">
      <AppIcon name="list" :size="18" />
    </button>
    <NuxtLink to="/" class="app-header__logo">Orlando Planner</NuxtLink>
    <NuxtLink v-if="!user" to="/auth/login" class="app-header__signin">Sign in</NuxtLink>
    <span v-else-if="user" class="app-header__user" :title="user.email">
      {{ user.displayName || user.email.split('@')[0] }}
    </span>
  </header>

  <div v-if="menuOpen" class="app-header__overlay" @click="closeMenu" />

  <nav v-if="menuOpen" class="app-header__drawer">
    <div class="app-header__drawer-head">
      <span class="app-header__drawer-title">Menu</span>
      <button type="button" class="app-header__drawer-close" aria-label="Close" @click="closeMenu">×</button>
    </div>

    <div class="app-header__drawer-body">
      <NuxtLink to="/" class="app-header__item" @click="closeMenu">
        <AppIcon name="grid" :size="16" /> Home
      </NuxtLink>
      <NuxtLink to="/trips" class="app-header__item" @click="closeMenu">
        <AppIcon name="calendar" :size="16" /> My trips
      </NuxtLink>
      <NuxtLink to="/new" class="app-header__item" @click="closeMenu">
        <AppIcon name="plus" :size="16" /> New trip
      </NuxtLink>

      <div class="app-header__divider" />

      <button
        v-if="hasTrip && user && !backed"
        type="button"
        class="app-header__item app-header__item--action"
        :disabled="saving"
        @click="saveCurrentTrip"
      >
        <AppIcon name="cloud" :size="16" />
        {{ saving ? 'Saving…' : 'Save current trip to account' }}
      </button>

      <button
        v-if="hasTrip && backed"
        type="button"
        class="app-header__item app-header__item--action app-header__item--success"
        @click="closeMenu"
      >
        <AppIcon name="check" :size="16" /> Current trip is saved
      </button>

      <div class="app-header__divider" />

      <div v-if="user" class="app-header__user-detail">
        Signed in as<br>
        <strong>{{ user.displayName || user.email }}</strong>
      </div>

      <button
        v-if="user"
        type="button"
        class="app-header__item app-header__item--action"
        @click="logout"
      >
        Sign out
      </button>
      <NuxtLink
        v-else
        to="/auth/login"
        class="app-header__item app-header__item--action"
        @click="closeMenu"
      >
        Sign in
      </NuxtLink>
    </div>

    <p v-if="message" role="status" class="app-header__message">{{ message }}</p>
  </nav>
</template>

<style scoped>
.app-header {
  position: relative;
  z-index: 50;
  height: 48px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 12px;
  background: var(--paper);
  border-bottom: 1px solid var(--warm-rule);
}

.app-header__menu-btn {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: none;
  background: #f2f4f9;
  color: var(--text-muted);
  cursor: pointer;
}

.app-header__logo {
  font: 700 16px/1 var(--font-display);
  color: var(--text);
  text-decoration: none;
  letter-spacing: -0.01em;
}

.app-header__signin {
  font-size: 13px;
  font-weight: 600;
  color: var(--c-navy);
  text-decoration: none;
  padding: 6px 10px;
  border-radius: 8px;
  background: #eef3fc;
}

.app-header__user {
  max-width: 120px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-header__overlay {
  position: fixed;
  inset: 48px 0 0 0;
  background: #0c101a40;
  z-index: 51;
}

.app-header__drawer {
  position: fixed;
  top: 48px;
  left: 0;
  bottom: 0;
  width: min(280px, 80vw);
  background: #fff;
  border-right: 1px solid var(--warm-border);
  z-index: 52;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 0 20px #0b142720;
}

.app-header__drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--warm-border);
}

.app-header__drawer-title {
  font: 700 16px/1 var(--font-display);
}

.app-header__drawer-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: #f2f4f9;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.app-header__drawer-body {
  flex: 1;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.app-header__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border-radius: 10px;
  color: var(--text);
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}

.app-header__item:hover {
  background: #f7f8fb;
}

.app-header__item--action {
  border: none;
  background: transparent;
  cursor: pointer;
  width: 100%;
  text-align: left;
  font: inherit;
}

.app-header__item--action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.app-header__item--success {
  color: #0f7d74;
  background: #f0f8f6;
}

.app-header__divider {
  height: 1px;
  background: var(--warm-border);
  margin: 8px 0;
}

.app-header__user-detail {
  padding: 10px 12px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.45;
}

.app-header__user-detail strong {
  color: var(--text);
  font-weight: 600;
}

.app-header__message {
  margin: 0 12px 12px;
  padding: 10px;
  border-radius: 8px;
  background: #eef4ef;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
