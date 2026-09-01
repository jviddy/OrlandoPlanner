<script setup lang="ts">
import { GLYPHS } from '~/data/glyphs'
import { PARK_BY_ID, RESORTS } from '~/data/parks'

const props = withDefaults(
  defineProps<{
    parkId?: string | null
    size?: number
    /** Show the date-of-month badge (grid only). */
    dateNumber?: number | string | null
    /** Day-view header: white circle with a resort-coloured glyph. */
    inverted?: boolean
    /** Drop the resort shadow (template previews). */
    flat?: boolean
    bob?: boolean
    strokeWidth?: number
  }>(),
  { size: 40, parkId: null, inverted: false, flat: false, bob: false },
)

const park = computed(() => (props.parkId ? PARK_BY_ID[props.parkId] ?? null : null))
const resort = computed(() => (park.value ? RESORTS[park.value.resort] : null))

const style = computed(() => {
  const r = resort.value
  let bg = r ? r.bg : 'rgba(255,255,255,.6)'
  let fg = r ? r.fg : 'var(--empty-ink)'
  let border = r ? 'none' : '1.5px dashed var(--empty-stroke)'
  let shadow = r && !props.flat ? `0 4px 10px ${r.shadow}` : 'none'

  if (props.inverted && r) {
    border = 'none'
    shadow = 'none'
    if (r.key === 'off') {
      bg = 'rgba(255,255,255,.8)'
      fg = '#7a5600'
    } else {
      bg = '#fff'
      fg = r.bg
    }
  }
  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    background: bg,
    border,
    boxShadow: shadow,
    '--glyph-ink': fg,
  }
})

const glyphSize = computed(() => Math.round(props.size * 0.52))
const sw = computed(
  () => props.strokeWidth ?? (park.value ? 1.7 : 2.2),
)
const glyph = computed(() => park.value?.glyph ?? GLYPHS.plus)
</script>

<template>
  <span class="circle" :style="style">
    <svg
      :class="{ 'anim-bob': bob }"
      :width="glyphSize"
      :height="glyphSize"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--glyph-ink)"
      :stroke-width="sw"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path :d="glyph" />
    </svg>
    <span
      v-if="dateNumber !== null && dateNumber !== undefined && dateNumber !== ''"
      class="circle__date"
      >{{ dateNumber }}</span
    >
  </span>
</template>

<style scoped>
.circle {
  flex: none;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.circle__date {
  position: absolute;
  top: -2px;
  right: -3px;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid var(--field-border-soft);
  font: 700 9px/13px var(--font-ui);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
