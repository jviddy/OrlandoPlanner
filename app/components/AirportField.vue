<script setup lang="ts">
/**
 * A single-input airport lookup. The user can type a code (MAN) or a name
 * (Manchester) and pick from a short filtered list. The selected airport's
 * code and name are emitted together.
 */
import { findAirport, AIRPORTS, formatRoute } from '~/data/airports'

const props = defineProps<{
  fromCode?: string
  fromName?: string
  toCode?: string
  toName?: string
  placeholder?: string
}>()

const emit = defineEmits<{
  update: [{
    route: string
    fromCode: string
    fromName: string
    toCode: string
    toName: string
  }]
}>()

const routeInput = ref('')
const isOpen = ref(false)
const containerRef = ref<HTMLDivElement | null>(null)

onMounted(() => {
  routeInput.value = formatRoute(props.fromCode, props.toCode)
})

watch(() => [props.fromCode, props.toCode], () => {
  routeInput.value = formatRoute(props.fromCode, props.toCode)
})

const parsed = computed(() => {
  const parts = routeInput.value.split(/\s*[→\->]\s*/).map((s) => s.trim())
  return {
    from: parts[0] ?? '',
    to: parts[1] ?? '',
  }
})

const matches = computed(() => {
  const list: { type: 'from' | 'to'; airport: typeof AIRPORTS[number] }[] = []
  const { from, to } = parsed.value
  if (from && !props.fromCode) {
    list.push(...findMatches(from).map((a) => ({ type: 'from' as const, airport: a })))
  }
  if (to && !props.toCode) {
    list.push(...findMatches(to).map((a) => ({ type: 'to' as const, airport: a })))
  }
  return list.slice(0, 6)
})

function findMatches(query: string) {
  const q = query.toLowerCase()
  return AIRPORTS.filter(
    (a) =>
      a.code.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q),
  )
}

function select(type: 'from' | 'to', airport: typeof AIRPORTS[number]) {
  const nextFromCode = type === 'from' ? airport.code : props.fromCode ?? ''
  const nextFromName = type === 'from' ? airport.name : props.fromName ?? ''
  const nextToCode = type === 'to' ? airport.code : props.toCode ?? ''
  const nextToName = type === 'to' ? airport.name : props.toName ?? ''
  emit('update', {
    route: formatRoute(nextFromCode, nextToCode),
    fromCode: nextFromCode,
    fromName: nextFromName,
    toCode: nextToCode,
    toName: nextToName,
  })
  // Keep focus on the input so the user can type the other side.
  const side = type === 'from' ? 'to' : 'from'
  routeInput.value = formatRoute(
    side === 'from' ? '' : nextFromCode,
    side === 'to' ? '' : nextToCode,
  )
  isOpen.value = true
}

function clearSide(side: 'from' | 'to') {
  const nextFromCode = side === 'from' ? '' : props.fromCode ?? ''
  const nextFromName = side === 'from' ? '' : props.fromName ?? ''
  const nextToCode = side === 'to' ? '' : props.toCode ?? ''
  const nextToName = side === 'to' ? '' : props.toName ?? ''
  emit('update', {
    route: formatRoute(nextFromCode, nextToCode),
    fromCode: nextFromCode,
    fromName: nextFromName,
    toCode: nextToCode,
    toName: nextToName,
  })
  routeInput.value = formatRoute(nextFromCode, nextToCode)
  isOpen.value = true
}

function onInput(e: Event) {
  routeInput.value = (e.target as HTMLInputElement).value
  isOpen.value = true
}

function onBlur() {
  // Delay so click on a result can fire first.
  setTimeout(() => {
    isOpen.value = false
    routeInput.value = formatRoute(props.fromCode, props.toCode)
  }, 150)
}

function onFocus() {
  routeInput.value = formatRoute(props.fromCode, props.toCode)
  isOpen.value = true
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    isOpen.value = false
    routeInput.value = formatRoute(props.fromCode, props.toCode)
  }
}
</script>

<template>
  <div ref="containerRef" class="airport-field">
    <div class="airport-field__input-wrap">
      <input
        class="input input--sm"
        type="text"
        :placeholder="placeholder || 'Airport → Airport'"
        :value="routeInput"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
      />
      <div v-if="fromCode || toCode" class="airport-field__tags">
        <button
          v-if="fromCode"
          type="button"
          class="airport-field__tag"
          @click="clearSide('from')"
        >
          {{ fromCode }} <span>×</span>
        </button>
        <span v-if="fromCode && toCode" class="airport-field__arrow">→</span>
        <button
          v-if="toCode"
          type="button"
          class="airport-field__tag"
          @click="clearSide('to')"
        >
          {{ toCode }} <span>×</span>
        </button>
      </div>
    </div>
    <div v-if="isOpen && matches.length" class="airport-field__results">
      <button
        v-for="(match, i) in matches"
        :key="`${match.type}-${match.airport.code}-${i}`"
        type="button"
        @mousedown.prevent="select(match.type, match.airport)"
      >
        <strong>{{ match.airport.code }}</strong>
        <span>{{ match.airport.name }}, {{ match.airport.city }}</span>
        <small>{{ match.type === 'from' ? 'From' : 'To' }}</small>
      </button>
    </div>
  </div>
</template>

<style scoped>
.airport-field {
  position: relative;
  flex: 1;
}
.airport-field__input-wrap {
  position: relative;
}
.airport-field__input-wrap input {
  width: 100%;
  padding-right: 8px;
}
.airport-field__tags {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  pointer-events: none;
}
.airport-field__tag {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: var(--r-pill);
  background: var(--tile-selected);
  color: var(--c-navy);
  font-size: 11px;
  font-weight: 700;
}
.airport-field__tag span {
  font-weight: 600;
  opacity: 0.7;
}
.airport-field__arrow {
  font-size: 11px;
  color: var(--text-faint);
}
.airport-field__results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 50;
  background: #fff;
  border: 1.5px solid var(--field-border);
  border-radius: var(--r-input);
  box-shadow: 0 8px 24px rgba(12, 16, 26, 0.12);
  overflow: hidden;
}
.airport-field__results button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  text-align: left;
  font-size: 13px;
}
.airport-field__results button:not(:last-child) {
  border-bottom: 1px solid var(--field-border-soft);
}
.airport-field__results button:hover,
.airport-field__results button:focus-visible {
  background: #f2f4f9;
}
.airport-field__results strong {
  flex: none;
  width: 42px;
  font-weight: 700;
  color: var(--c-navy);
}
.airport-field__results span {
  flex: 1;
  color: var(--text);
}
.airport-field__results small {
  flex: none;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-faint);
  text-transform: uppercase;
}
</style>
