<script setup lang="ts">
const route = useRoute()
const verifying = ref(true)
const error = ref('')
const success = ref(false)

onMounted(async () => {
  const hash = window.location.hash
  const params = new URLSearchParams(hash.replace(/^#\/?/, ''))
  const token = params.get('token') ?? ''
  const redirect = params.get('redirect') ?? '/trips'

  if (!token || token.length < 32) {
    error.value = 'This sign-in link is invalid or has expired.'
    verifying.value = false
    return
  }

  try {
    await $fetch('/api/auth/verify', { method: 'POST', body: { token, redirectPath: redirect } })
    success.value = true
    navigateTo(redirect, { replace: true })
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'This sign-in link is invalid or has expired.'
    verifying.value = false
  }
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <template v-if="verifying">
        <h1>Signing you in...</h1>
        <p class="auth-sub">Verifying your sign-in link.</p>
      </template>
      <template v-else-if="error">
        <h1>Sign-in failed</h1>
        <p class="auth-sub">{{ error }}</p>
        <NuxtLink to="/auth/login" class="auth-btn" style="text-decoration:none;text-align:center;display:block">Try again</NuxtLink>
      </template>
    </div>
  </div>
</template>

<style scoped>
.auth-page { display: flex; justify-content: center; align-items: center; min-height: 80vh; padding: 20px; }
.auth-card { width: 100%; max-width: 380px; padding: 32px; border: 1px solid var(--warm-border); border-radius: var(--r-card); background: #fff; }
.auth-card h1 { font-size: 22px; margin: 0 0 6px; }
.auth-sub { color: var(--text-muted); font-size: 13px; margin: 0 0 20px; line-height: 1.45; }
.auth-btn { padding: 10px 16px; border: none; border-radius: 9px; background: var(--c-navy); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
</style>
