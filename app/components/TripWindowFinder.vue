<script setup lang="ts">
import { rankTripWindows, type TripDay, type TripPreference, type TripResult } from '~/utils/tripWindows'
import { matchesTemperaturePreference } from '~/utils/orlandoClimate'

const props = withDefaults(defineProps<{ days: TripDay[]; defaultOpen?: boolean; resultCount?: number; compact?: boolean }>(), {
  defaultOpen: false,
  resultCount: 3,
  compact: false,
})
const emit = defineEmits<{
  highlight: [range: { start: string; end: string } | null]
  suggestions: [results: TripResult[]]
  period: [range: { start: string; end: string }]
}>()
const nights = ref(14)
const preferences = ref<TripPreference[]>([{ key: 'crowds', required: false }])
const enabled = ref(props.defaultOpen)
const earliest = ref(props.days[0]?.date ?? '')
const latest = ref(props.days.at(-1)?.date ?? '')
const chosen = ref('')
const disneyEvents = new Set(['MNSSHP', "Mickey's Very Merry Christmas Party", 'Jollywood Nights'])
const options = [
  { key: 'crowds', label: 'Low crowds' }, { key: 'holiday', label: 'UK school holidays' },
  { key: 'term', label: 'UK term time' }, { key: 'cool', label: 'Cooler months' },
  { key: 'festival:epcot', label: 'Any EPCOT festival' },
  { key: 'event:disney', label: 'Disney ticketed evenings' },
  { key: 'event:HHN', label: 'Halloween Horror Nights' },
]
function score(day: TripDay, key: string) {
  if (key === 'crowds') return day.rating <= 2 ? 1 : (5 - day.rating) / 3
  if (key === 'holiday' || key === 'term') return Number(day.factors.some(f => f.startsWith('UK schools:')) === (key === 'holiday'))
  if (key === 'cool') return Number(matchesTemperaturePreference(Number(day.date.slice(5, 7)) - 1, 'cool'))
  if (key === 'festival:epcot') return Number(day.factors.some(f => f.startsWith('EPCOT festival:')))
  if (key === 'event:disney') return Number(day.eveningEvents?.some(e => disneyEvents.has(e.name)))
  return Number(day.eveningEvents?.some(e => e.name === 'Halloween Horror Nights'))
}
const valid = computed(() => preferences.value.length > 0 && earliest.value <= latest.value && Number.isInteger(nights.value) && nights.value >= 1 && nights.value <= 30)
const visibleOptions = computed(() => preferences.value.length === 3
  ? preferences.value.map(p => options.find(o => o.key === p.key)!)
  : [...preferences.value.map(p => options.find(o => o.key === p.key)!), ...options.filter(o => !preferences.value.some(p => p.key === o.key))])
function toggle(key: string) {
  const index = preferences.value.findIndex(p => p.key === key)
  if (index >= 0) preferences.value.splice(index, 1)
  else if (preferences.value.length < 3) preferences.value.push({ key, required: false })
}
const ranked = computed(() => enabled.value && valid.value
  ? rankTripWindows(props.days.filter(d => d.date >= earliest.value && d.date <= latest.value), nights.value, preferences.value, score)
  : [])
const suggestions = computed(() => {
  const picks: TripResult[] = []
  for (const result of ranked.value) {
    if (picks.every(p => result.start > p.end || result.end < p.start)) picks.push(result)
    if (picks.length === props.resultCount) break
  }
  return picks
})
watch([ranked, enabled], () => { chosen.value = ''; emit('highlight', null) })
watch(suggestions, value => emit('suggestions', value), { immediate: true })
watch([earliest, latest], ([start, end]) => emit('period', { start: start!, end: end! }), { immediate: true })
function move(index: number, direction: number) {
  const copy = [...preferences.value]
  ;[copy[index], copy[index + direction]] = [copy[index + direction]!, copy[index]!]
  preferences.value = copy
}
function select(result: TripResult) { chosen.value = result.start; emit('highlight', result) }
function label(key: string) { return options.find(o => o.key === key)?.label ?? key }
function shortDate(value: string) { return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) }
</script>

<template>
  <section class="trip-finder" :class="{ compact }">
    <label v-if="!defaultOpen" class="finder-toggle"><input v-model="enabled" type="checkbox"> Find my trip dates</label>
    <template v-if="enabled">
      <div class="trip-fields">
        <label>Nights<input v-model.number="nights" type="number" min="1" max="30" inputmode="numeric"></label>
        <label>Travel after<input v-model="earliest" type="date" :min="days[0]?.date" :max="days.at(-1)?.date"></label>
        <label>Return by<input v-model="latest" type="date" :min="days[0]?.date" :max="days.at(-1)?.date"></label>
      </div>
      <div class="preference-head"><strong>What matters most?</strong><span>{{ preferences.length }}/3 selected · order sets priority</span></div>
      <div class="factor-list">
        <div v-for="(option, i) in visibleOptions" :key="option.key" class="factor-row" :class="{ active: i < preferences.length }">
          <button class="factor-choice" :aria-pressed="i < preferences.length" @click="toggle(option.key)">
            <span class="factor-number">{{ i < preferences.length ? i + 1 : '+' }}</span><span>{{ option.label }}</span><span v-if="i < preferences.length" aria-hidden="true">✓</span>
          </button>
          <template v-if="i < preferences.length">
            <label class="required"><input v-model="preferences[i]!.required" type="checkbox">Must</label>
            <button :disabled="i === 0" :aria-label="`Move ${option.label} up`" @click="move(i, -1)">↑</button>
            <button :disabled="i === preferences.length - 1" :aria-label="`Move ${option.label} down`" @click="move(i, 1)">↓</button>
          </template>
        </div>
      </div>
      <p class="method">“Must” applies every day for crowds, school dates and temperature. A festival or event only needs one night. Cooler months are below Orlando's 22.8°C annual mean. Future events may be educated guesses.</p>
      <p v-if="!valid" class="message" role="status">Choose at least one factor, 1–30 nights and a valid date range.</p>
      <div v-else class="results" aria-live="polite">
        <p v-if="!suggestions.length" class="message">No complete stay meets those requirements. Widen the dates or untick “Must”.</p>
        <button v-for="(result, i) in suggestions" :key="result.start" class="trip-result" :class="`choice-${i + 1}`" :aria-pressed="chosen === result.start" @click="select(result)">
          <span class="result-number">{{ i + 1 }}</span>
          <span><strong>{{ shortDate(result.start) }} – {{ shortDate(result.end) }}</strong><small>{{ nights }} nights · crowds {{ result.average.toFixed(1) }}/5</small></span>
          <span class="result-scores"><small v-for="(preference, j) in preferences" :key="preference.key">{{ j + 1 }} {{ label(preference.key) }} {{ Math.round(result.scores[j]! * 100) }}%</small></span>
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.trip-finder{border:1px solid #acbeb2;background:#f2f6ee;border-radius:12px;padding:14px;margin:14px 0;color:#24473e}.finder-toggle{font-weight:700;display:flex;gap:9px;align-items:center;min-height:40px}.trip-fields{display:grid;grid-template-columns:100px repeat(2,minmax(150px,1fr));gap:8px;margin-bottom:12px}.trip-fields label{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:700}.trip-finder input:not([type=checkbox]){box-sizing:border-box;width:100%;min-width:0;min-height:40px;padding:8px;border:1px solid #acbeb2;border-radius:6px;background:white;font:inherit}.preference-head{display:flex;justify-content:space-between;gap:8px;align-items:baseline;margin:4px 0 7px}.preference-head strong{font-size:13px}.preference-head span{font-size:10px;color:#627169}.factor-list{display:flex;flex-direction:column;gap:4px}.factor-row{display:flex;align-items:center;gap:3px;border:1px solid #c5d0c6;border-radius:7px;background:#fff;padding:2px 4px}.factor-row.active{background:#dfecdd;border-color:#24473e;box-shadow:inset 3px 0 #24473e}.trip-finder button{color:inherit;cursor:pointer}.trip-finder button:disabled{opacity:.3;cursor:default}.factor-choice{display:flex;align-items:center;gap:6px;flex:1;min-width:0;min-height:38px;text-align:left;border:0;background:transparent;padding:4px;font-size:12px}.factor-choice>span:nth-child(2){flex:1;overflow-wrap:anywhere}.factor-number{flex:0 0 18px;font-weight:800;text-align:center}.factor-row .required{display:flex;align-items:center;gap:2px;font-size:10px;min-height:40px;cursor:pointer}.factor-row input[type=checkbox],.finder-toggle input{width:18px;height:18px;accent-color:#24473e}.factor-row>button:not(.factor-choice){flex:0 0 38px;min-width:38px;min-height:40px;padding:3px;border:0;background:transparent;font-size:16px}.method,.message{font-size:10px;line-height:1.45;margin:8px 0;color:#617169}.results{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:9px}.trip-result{display:grid;grid-template-columns:27px 1fr;gap:5px;text-align:left;border:1px solid #9aafa1;border-radius:7px;background:white;padding:8px;min-width:0}.trip-result[aria-pressed=true]{outline:2px solid #24473e}.result-number{grid-row:1/3;display:grid;place-items:center;width:25px;height:25px;color:white;border-radius:50%;font-weight:800}.choice-1 .result-number{background:#276353}.choice-2 .result-number{background:#9a622b}.choice-3 .result-number{background:#71558b}.trip-result strong,.trip-result small{display:block}.trip-result strong{font-size:11px}.trip-result small{font-size:9px;line-height:1.35;margin-top:2px}.result-scores{grid-column:2}.compact{padding:10px}.compact .method{margin-bottom:4px}
@media(max-width:700px){.trip-finder{padding:9px;margin:9px 0}.trip-fields{grid-template-columns:64px repeat(2,minmax(0,1fr));gap:5px}.trip-finder input:not([type=checkbox]){font-size:12px;padding:6px;min-height:42px}.preference-head{align-items:end}.preference-head span{max-width:130px;text-align:right}.factor-row{gap:1px}.factor-choice{font-size:11px;gap:3px;min-height:42px}.factor-row .required{font-size:9px}.factor-row>button:not(.factor-choice){flex-basis:34px;min-width:34px}.method{font-size:9px}.results{grid-template-columns:1fr}.trip-result{grid-template-columns:29px minmax(0,1fr) auto;padding:7px}.result-scores{grid-column:3;grid-row:1/3;max-width:115px}.trip-result strong{font-size:12px}}
</style>
