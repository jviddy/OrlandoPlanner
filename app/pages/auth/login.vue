<script setup lang="ts">
const config = useRuntimeConfig()
const route = useRoute()
const email = ref('')
const sending = ref(false)
const sent = ref(false)
const error = ref('')
const googleEnabled = computed(() => Boolean(config.public.googleEnabled))
const redirect = computed(() => typeof route.query.redirect === 'string' ? route.query.redirect : '/trips')

async function sendMagicLink() {
  if (!email.value.trim()) return
  sending.value = true; error.value = ''
  try {
    await $fetch('/api/auth/magic-link', { method: 'POST', body: { email: email.value.trim(), redirectPath: redirect.value } })
    sent.value = true
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'Could not send sign-in link. Try again.'
  }
  sending.value = false
}
function loginWithGoogle() {
  navigateTo(`/api/auth/google/start?redirect=${encodeURIComponent(redirect.value)}`, { external: true })
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1>Sign in to Orlando Planner</h1>
      <p class="auth-sub">Save your trip to your account and access it from any device.</p>

      <form v-if="!sent" class="auth-form" @submit.prevent="sendMagicLink">
        <label class="field">
          <span>Email address</span>
          <input v-model="email" class="input" type="email" placeholder="you@example.com" required autocomplete="email" />
        </label>
        <p v-if="error" class="auth-error">{{ error }}</p>
        <button type="submit" class="auth-btn" :disabled="sending">
          {{ sending ? 'Sending...' : 'Send sign-in link' }}
        </button>
      </form>

      <div v-else class="auth-sent">
        <p>Check your email for a sign-in link. It expires in 15 minutes.</p>
        <button type="button" class="auth-btn auth-btn--secondary" @click="sent = false">Use a different email</button>
      </div>

      <div v-if="googleEnabled" class="auth-divider">
        <span>or</span>
      </div>

      <button v-if="googleEnabled" type="button" class="auth-google-btn" @click="loginWithGoogle">
        Sign in with Google
      </button>
    </div>
  </div>
</template>

<style scoped>
.auth-page { display: flex; justify-content: center; align-items: center; min-height: 80vh; padding: 20px; }
.auth-card { width: 100%; max-width: 380px; padding: 32px; border: 1px solid var(--warm-border); border-radius: var(--r-card); background: #fff; }
.auth-card h1 { font-size: 22px; margin: 0 0 6px; }
.auth-sub { color: var(--text-muted); font-size: 13px; margin: 0 0 20px; line-height: 1.45; }
.auth-form { display: flex; flex-direction: column; gap: 14px; }
.auth-btn { padding: 10px 16px; border: none; border-radius: 9px; background: var(--c-navy); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
.auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.auth-btn--secondary { background: transparent; color: var(--c-navy); font-weight: 600; }
.auth-error { color: var(--warn-ink); font-size: 12px; margin: 0; }
.auth-sent p { color: var(--text-muted); font-size: 13px; line-height: 1.45; }
.auth-divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; color: var(--text-muted); font-size: 12px; }
.auth-divider::before, .auth-divider::after { content: ''; flex: 1; height: 1px; background: var(--warm-border); }
.auth-google-btn { width: 100%; padding: 10px 16px; border: 1px solid var(--warm-border); border-radius: 9px; background: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
.auth-google-btn:hover { background: #f8f8f8; }
</style>
