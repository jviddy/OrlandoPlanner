<script setup lang="ts">
import { ICONS, type IconName } from '~/data/glyphs'

withDefaults(
  defineProps<{ name: IconName; size?: number | string; stroke?: number | string }>(),
  { size: 18, stroke: 2 },
)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="ICONS[name]" />
  </svg>
</template>
