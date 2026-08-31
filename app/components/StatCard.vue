<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  hint?: string
  icon?: string
  accent?: string
  to?: string
}>()
</script>

<template>
  <component
    :is="to ? 'NuxtLink' : 'div'"
    :to="to"
    class="stat card card-pad"
    :class="{ 'stat--link': to }"
    :style="accent ? { '--stat-accent': accent } : undefined"
  >
    <div class="stat__top">
      <span class="stat__label">{{ label }}</span>
      <AppIcon v-if="icon" :name="icon" :size="18" class="stat__icon" />
    </div>
    <div class="stat__value">{{ value }}</div>
    <div v-if="hint" class="stat__hint muted">{{ hint }}</div>
  </component>
</template>

<style scoped>
.stat {
  --stat-accent: var(--accent);
  position: relative;
  overflow: hidden;
}
.stat::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--stat-accent);
}
.stat--link {
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.stat--link:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.stat__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-muted);
}
.stat__label {
  font-size: 0.82rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.stat__icon {
  color: var(--stat-accent);
}
.stat__value {
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 1.2rem + 1.4vw, 2rem);
  font-weight: 680;
  margin-top: 6px;
  line-height: 1.1;
}
.stat__hint {
  font-size: 0.85rem;
  margin-top: 4px;
}
</style>
