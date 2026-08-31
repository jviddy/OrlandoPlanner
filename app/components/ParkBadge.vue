<script setup lang="ts">
import { PARK_BY_ID } from '~/data/parks'

const props = defineProps<{ parkId: string | null | undefined; short?: boolean }>()

const park = computed(() =>
  props.parkId ? PARK_BY_ID[props.parkId] ?? null : null,
)
</script>

<template>
  <span
    class="chip chip-dot"
    :style="{ '--chip-color': park?.color ?? 'var(--text-faint)' }"
  >
    {{ short ? (park?.short ?? '—') : (park?.name ?? 'No park set') }}
  </span>
</template>
