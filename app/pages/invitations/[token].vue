<script setup lang="ts">
useHead({ title: 'Accept invitation · Orlando Planner' })

const route = useRoute()
const token = computed(() => String(route.params.token || ''))
const status = ref<'idle' | 'loading' | 'accepted' | 'error'>('idle')
const message = ref('')

onMounted(async () => {
  if (!token.value) {
    status.value = 'error'
    message.value = 'Missing invitation token.'
    return
  }
  status.value = 'loading'
  try {
    await $fetch(`/api/invitations/${token.value}/accept`, { method: 'POST' })
    status.value = 'accepted'
    message.value = 'Invitation accepted. Redirecting to your trips…'
    setTimeout(() => navigateTo('/trips', { replace: true }), 1200)
  } catch (err: any) {
    status.value = 'error'
    message.value = err?.data?.statusMessage || 'Could not accept the invitation. It may have expired or already been used.'
  }
})
</script>

<template>
  <div class="screen accept">
    <div class="accept__card">
      <h1>Accept invitation</h1>
      <p v-if="status === 'loading'">Accepting…</p>
      <p v-else-if="status === 'accepted'" class="accept__success">{{ message }}</p>
      <p v-else-if="status === 'error'" class="accept__error">{{ message }}</p>
      <NuxtLink v-if="status === 'error'" to="/auth/login">Sign in</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.accept {
  display: grid;
  place-items: center;
  padding: 20px;
  background: var(--sand);
}
.accept__card {
  width: min(100%, 420px);
  padding: 28px;
  border-radius: var(--r-card);
  background: #fff;
  box-shadow: var(--sh-template);
  text-align: center;
}
.accept__card h1 {
  font-size: 24px;
  margin: 0 0 12px;
}
.accept__card p {
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.5;
}
.accept__success {
  color: #0f7d74;
}
.accept__error {
  color: var(--warn-ink);
}
</style>
