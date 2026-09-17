<script setup lang="ts">
defineProps<{ markers: { key: string; symbol: string; label: string }[]; detailed?: boolean }>()
</script>

<template>
  <span class="overlay-markers" :class="{ detailed }">
    <span v-for="marker in markers" :key="marker.key" :class="`marker-${marker.key}`" :title="marker.label" :aria-label="marker.label">
      {{ marker.symbol }}<span v-if="detailed"> {{ marker.label }}</span>
    </span>
  </span>
</template>

<style scoped>
.overlay-markers{display:flex;justify-content:center;gap:1px;font-size:9px;line-height:12px;font-style:normal}
.overlay-markers>span{font-weight:800;text-shadow:0 0 2px white}
.marker-uk{color:#553b89}.marker-festival{color:#155b65}.marker-evening{color:#473523}
.detailed{flex-wrap:wrap;justify-content:flex-start;gap:4px;font-size:11px;line-height:1.4}
.detailed>span{background:#ffffffb3;border-radius:4px;padding:3px 5px;text-shadow:none}
</style>
