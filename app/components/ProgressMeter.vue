<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    value: number
    max?: number
    label?: string
    accent?: string
    showPct?: boolean
  }>(),
  { max: 100, showPct: true },
)

const pct = computed(() => {
  if (props.max <= 0) return 0
  return Math.max(0, Math.min(100, (props.value / props.max) * 100))
})
</script>

<template>
  <div class="meter" :style="accent ? { '--meter-accent': accent } : undefined">
    <div v-if="label || showPct" class="meter__head">
      <span v-if="label">{{ label }}</span>
      <span v-if="showPct" class="muted">{{ Math.round(pct) }}%</span>
    </div>
    <div
      class="meter__track"
      role="progressbar"
      :aria-valuenow="Math.round(pct)"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="meter__fill" :style="{ width: `${pct}%` }" />
    </div>
  </div>
</template>

<style scoped>
.meter {
  --meter-accent: var(--accent);
  display: grid;
  gap: 6px;
}
.meter__head {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  font-weight: 600;
}
.meter__track {
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--bg-sunk);
  overflow: hidden;
  border: 1px solid var(--border);
}
.meter__fill {
  height: 100%;
  border-radius: inherit;
  background: var(--meter-accent);
  transition: width 0.35s ease;
}
</style>
