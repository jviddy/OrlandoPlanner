<script setup lang="ts">
import { GLYPHS } from '~/data/glyphs'
import { RESORTS, resolvePark } from '~/data/parks'

const store = useTripStore()

const props = withDefaults(
  defineProps<{
    parkId?: string | null
    /** Second park, for a park-hopper day — renders a diagonal split circle. */
    secondParkId?: string | null
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
  { size: 40, parkId: null, secondParkId: null, inverted: false, flat: false, bob: false },
)

const park = computed(() => resolvePark(props.parkId, store.customActivities))
const park2 = computed(() => resolvePark(props.secondParkId, store.customActivities))
const resort = computed(() => (park.value ? RESORTS[park.value.resort] : null))
const resort2 = computed(() => (park2.value ? RESORTS[park2.value.resort] : null))
/** Two different parks — the diagonal split. A single repeated park counts as one. */
const isSplit = computed(
  () => Boolean(park.value && park2.value && props.parkId !== props.secondParkId),
)

const style = computed(() => {
  const r = resort.value
  let bg = r ? r.bg : 'rgba(255,255,255,.6)'
  let border = r ? 'none' : '1.5px dashed var(--empty-stroke)'
  let shadow = r && !props.flat ? `0 4px 10px ${r.shadow}` : 'none'

  if (isSplit.value) {
    bg = `linear-gradient(135deg, ${resort.value!.bg} 50%, ${resort2.value!.bg} 50%)`
    border = 'none'
  } else if (props.inverted && r) {
    border = 'none'
    shadow = 'none'
    bg = r.key === 'off' ? 'rgba(255,255,255,.8)' : '#fff'
  }

  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    background: bg,
    border,
    boxShadow: shadow,
  }
})

function ink(r: { key: string; fg: string; bg: string } | null): string {
  if (!r) return 'var(--empty-ink)'
  if (isSplit.value) return r.fg
  if (props.inverted) return r.key === 'off' ? '#7a5600' : r.bg
  return r.fg
}

const glyphSize = computed(() => Math.round(props.size * (isSplit.value ? 0.36 : 0.52)))
const sw = computed(() => props.strokeWidth ?? (park.value ? 1.7 : 2.2))
const glyph = computed(() => park.value?.glyph ?? GLYPHS.plus)
</script>

<template>
  <span class="circle" :style="style">
    <template v-if="isSplit">
      <svg
        class="circle__glyph circle__glyph--a"
        :width="glyphSize"
        :height="glyphSize"
        viewBox="0 0 24 24"
        fill="none"
        :stroke="ink(resort)"
        :stroke-width="sw"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path :d="park!.glyph" />
      </svg>
      <svg
        class="circle__glyph circle__glyph--b"
        :width="glyphSize"
        :height="glyphSize"
        viewBox="0 0 24 24"
        fill="none"
        :stroke="ink(resort2)"
        :stroke-width="sw"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path :d="park2!.glyph" />
      </svg>
    </template>
    <svg
      v-else
      :class="{ 'anim-bob': bob }"
      :width="glyphSize"
      :height="glyphSize"
      viewBox="0 0 24 24"
      fill="none"
      :stroke="ink(resort)"
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
.circle__glyph {
  position: absolute;
}
.circle__glyph--a {
  top: 24%;
  left: 24%;
  transform: translate(-50%, -50%);
}
.circle__glyph--b {
  top: 76%;
  left: 76%;
  transform: translate(-50%, -50%);
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
