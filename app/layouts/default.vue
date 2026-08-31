<script setup lang="ts">
const store = useTripStore()
const hydrated = useHydrated()

const countdown = computed(() => {
  if (!hydrated.value) return ''
  const d = store.daysUntilStart
  if (d === null) return 'No dates set'
  if (d > 1) return `${d} days to go`
  if (d === 1) return 'Tomorrow!'
  if (d === 0) return "It's today 🎉"
  if (d > -store.dayCount) return 'Trip in progress'
  return 'Welcome back'
})
</script>

<template>
  <div class="shell">
    <header class="shell__header">
      <div class="container shell__bar">
        <NuxtLink to="/" class="brand">
          <span class="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="30" height="30">
              <circle cx="32" cy="28" r="13" fill="var(--c-sun)" />
              <circle cx="22" cy="20" r="6" fill="var(--c-sun)" />
              <circle cx="42" cy="20" r="6" fill="var(--c-sun)" />
              <path d="M12 54c5-11 13-16 20-16s15 5 20 16z" fill="var(--c-coral)" />
            </svg>
          </span>
          <span class="brand__text">
            <strong>Orlando Planner</strong>
            <small v-if="hydrated" class="muted">{{ store.trip.name }}</small>
          </span>
        </NuxtLink>

        <span class="shell__countdown chip">
          <AppIcon name="calendar" :size="13" />
          <ClientOnly>{{ countdown }}<template #fallback>Loading…</template></ClientOnly>
        </span>
      </div>
      <div class="shell__navwrap container">
        <AppNav />
      </div>
    </header>

    <main class="shell__main container">
      <slot />
    </main>

    <footer class="shell__footer container">
      <p class="muted">
        Built with Nuxt · data stays in your browser · deploy target Cloudflare
        Pages
      </p>
    </footer>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.shell__header {
  position: sticky;
  top: 0;
  z-index: 15;
  background: color-mix(in srgb, var(--bg-elev) 88%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}
.shell__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  padding-bottom: 10px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand__mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--c-navy);
}
.brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}
.brand__text strong {
  font-family: var(--font-display);
  font-size: 1.05rem;
}
.brand__text small {
  font-size: 0.78rem;
}
.shell__countdown {
  font-size: 0.8rem;
}
.shell__navwrap {
  padding-bottom: 10px;
  overflow-x: auto;
  scrollbar-width: none;
}
.shell__navwrap::-webkit-scrollbar {
  display: none;
}
.shell__main {
  flex: 1;
  padding-top: 28px;
  padding-bottom: 56px;
}
.shell__footer {
  padding-block: 24px;
  border-top: 1px solid var(--border);
  font-size: 0.82rem;
}

@media (max-width: 860px) {
  .shell__navwrap {
    display: none;
  }
  .shell__main {
    padding-bottom: 96px;
  }
}
</style>
