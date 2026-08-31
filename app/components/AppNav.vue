<script setup lang="ts">
const links = [
  { to: '/', label: 'Dashboard', icon: 'home' },
  { to: '/itinerary', label: 'Itinerary', icon: 'map' },
  { to: '/attractions', label: 'Attractions', icon: 'ticket' },
  { to: '/budget', label: 'Budget', icon: 'wallet' },
  { to: '/packing', label: 'Packing', icon: 'bag' },
  { to: '/settings', label: 'Settings', icon: 'gear' },
]
</script>

<template>
  <nav class="nav" aria-label="Primary">
    <NuxtLink
      v-for="l in links"
      :key="l.to"
      :to="l.to"
      class="nav__link"
      active-class="nav__link--active"
    >
      <AppIcon :name="l.icon" :size="18" />
      <span>{{ l.label }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.nav {
  display: flex;
  gap: 2px;
}
.nav__link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 13px;
  border-radius: var(--radius-pill);
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-muted);
  white-space: nowrap;
  transition: background 0.14s ease, color 0.14s ease;
}
.nav__link:hover {
  background: var(--bg-sunk);
  color: var(--text);
}
.nav__link--active {
  background: var(--accent);
  color: var(--accent-contrast);
}
.nav__link--active:hover {
  background: var(--accent);
  color: var(--accent-contrast);
}

@media (max-width: 860px) {
  .nav {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 20;
    background: var(--bg-elev);
    border-top: 1px solid var(--border);
    padding: 6px max(8px, env(safe-area-inset-left)) calc(6px + env(safe-area-inset-bottom));
    justify-content: space-between;
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.06);
  }
  .nav__link {
    flex-direction: column;
    gap: 3px;
    padding: 6px 4px;
    font-size: 0.68rem;
    flex: 1;
    border-radius: var(--radius-sm);
  }
  .nav__link span {
    line-height: 1;
  }
}
</style>
