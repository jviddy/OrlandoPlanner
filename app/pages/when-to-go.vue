<script setup lang="ts">
import type { TripResult } from '~/utils/tripWindows'

definePageMeta({ layout: false })
useHead({ title: 'When should we travel? · Orlando Planner' })
type Day = { date: string; rating: number; factors: string[]; eveningEvents?: { name: string }[] }
type Dataset = { end: string; days: Day[] }
const { data, status, error } = await useFetch<Dataset>('/data/crowd-calendar.json', { server: false })
const today = new Date().toISOString().slice(0, 10)
const days = computed(() => (data.value?.days ?? []).filter(day => day.date >= today))
const suggestions = ref<TripResult[]>([])
const period = ref({ start: today, end: '2029-01-31' })
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayIndex = computed(() => new Map(days.value.map(day => [day.date, day])))
const monthRows = computed(() => {
  if (!days.value.length || period.value.start > period.value.end) return []
  const start = new Date(`${period.value.start.slice(0, 7)}-01T00:00:00Z`)
  const end = period.value.end.slice(0, 7)
  const rows = []
  for (let cursor = start; cursor.toISOString().slice(0, 7) <= end; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) {
    const year = cursor.getUTCFullYear()
    const month = cursor.getUTCMonth()
    const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const cells = Array.from({ length: 31 }, (_, i) => {
      if (i >= count) return undefined
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
      return date >= period.value.start && date <= period.value.end ? dayIndex.value.get(date) : undefined
    })
    rows.push({ key: `${year}-${month}`, label: `${monthNames[month]} ${year}`, cells })
  }
  return rows
})
function suggestionNumber(date: string) { return suggestions.value.findIndex(result => date >= result.start && date <= result.end) + 1 }
function isStart(date: string) { return suggestions.value.findIndex(result => date === result.start) + 1 }
</script>

<template>
  <main class="when-page">
    <header>
      <NuxtLink to="/crowds">← Full crowd calendar</NuxtLink>
      <p>ORLANDO TRIP PLANNER</p>
      <h1>When should we travel?</h1>
      <span>Tell us what matters most. We’ll compare every complete stay and show the three strongest options.</span>
    </header>
    <p v-if="error" role="alert">The planning data could not be loaded. Please reload.</p>
    <p v-else-if="status === 'pending'">Loading trip dates…</p>
    <template v-else-if="data">
      <TripWindowFinder :days="days" default-open compact :result-count="3" @suggestions="suggestions = $event" @period="period = $event" />
      <section class="candidate-calendar" aria-label="Top three suggested stays across the selected travel period">
        <div class="calendar-title">
          <strong>Your best windows</strong>
          <span><i class="key-1">1</i><i class="key-2">2</i><i class="key-3">3</i> Recommendations · background shows crowd level</span>
        </div>
        <div class="day-axis" aria-hidden="true"><span>Month</span><small v-for="dayNumber in 31" :key="dayNumber">{{ [1, 5, 10, 15, 20, 25, 31].includes(dayNumber) ? dayNumber : '' }}</small></div>
        <div class="calendar-rows">
          <div v-for="row in monthRows" :key="row.key" class="month-row">
            <strong>{{ row.label }}</strong>
            <template v-for="(day, i) in row.cells" :key="i">
              <button v-if="day" :class="[`level-${day.rating}`, suggestionNumber(day.date) ? `suggestion-${suggestionNumber(day.date)}` : '']" :title="`${day.date} · crowd level ${day.rating}/5${suggestionNumber(day.date) ? ` · recommendation ${suggestionNumber(day.date)}` : ''}`" :aria-label="`${day.date}, crowd level ${day.rating} out of 5${suggestionNumber(day.date) ? `, recommendation ${suggestionNumber(day.date)}` : ''}`">
                <b v-if="isStart(day.date)">{{ isStart(day.date) }}</b>
              </button>
              <span v-else />
            </template>
          </div>
        </div>
        <p>Every row is one month; days run from 1 to 31. Recommendations are kept separate so all three remain easy to compare.</p>
      </section>
      <footer>Predictions are provisional. UK school dates, festival windows and future evening events may be estimates. <NuxtLink to="/crowds">Explore all factors and day details →</NuxtLink></footer>
    </template>
  </main>
</template>

<style scoped>
.when-page{position:fixed;inset:0;overflow:auto;background:#faf8f2;color:#233a38;padding:18px;font-family:var(--font-ui)}header{max-width:980px;margin:auto}header>a,footer a{color:#355b55;font-size:12px}header p{font-size:10px;font-weight:800;letter-spacing:.15em;margin:18px 0 6px}h1{font:700 clamp(30px,5vw,52px)/1.05 var(--font-display);margin:0 0 6px}header>span{font-size:13px;line-height:1.45;color:#5c6c67}.when-page>template,.trip-finder,.candidate-calendar,footer{max-width:980px;margin-left:auto;margin-right:auto}.candidate-calendar{border:1px solid #d1d9d0;background:#fffdf8;border-radius:12px;padding:10px;margin-top:10px}.calendar-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}.calendar-title strong{font-size:14px}.calendar-title span{font-size:9px;color:#68756e;display:flex;align-items:center;gap:3px}.calendar-title i{display:inline-grid;place-items:center;width:15px;height:15px;border-radius:50%;color:white;font-style:normal;font-weight:800}.key-1{background:#276353}.key-2{background:#9a622b}.key-3{background:#71558b}.day-axis,.month-row{display:grid;grid-template-columns:52px repeat(31,minmax(3px,1fr));gap:1px}.day-axis{margin-bottom:2px}.day-axis span,.day-axis small{font-size:7px;color:#748078;text-align:center}.day-axis span{text-align:left;font-weight:700}.calendar-rows{display:flex;flex-direction:column;gap:2px}.month-row{height:14px}.month-row>strong{font-size:8px;line-height:14px}.month-row>button,.month-row>span{display:block;min-width:0;border:0;border-radius:1px;padding:0;position:relative}.month-row>span{background:#efeee9}.level-1{background:#d9eee7}.level-2{background:#e7efd1}.level-3{background:#fae7b4}.level-4{background:#f5c99e}.level-5{background:#e9aaa0}.suggestion-1{box-shadow:inset 0 0 0 2px #276353}.suggestion-2{box-shadow:inset 0 0 0 2px #9a622b}.suggestion-3{box-shadow:inset 0 0 0 2px #71558b}.month-row b{position:absolute;z-index:2;left:-4px;top:-3px;width:12px;height:12px;border-radius:50%;background:#233a38;color:white;font:800 7px/12px sans-serif}.candidate-calendar>p,footer{font-size:9px;line-height:1.45;color:#66736a;margin:7px 0 0}footer{padding:14px 2px 30px}
@media(max-width:700px){.when-page{padding:10px}header p{margin-top:12px}h1{font-size:30px}.calendar-title{align-items:flex-start}.calendar-title span{max-width:170px;text-align:right}.candidate-calendar{padding:8px 5px}.day-axis,.month-row{grid-template-columns:44px repeat(31,minmax(2px,1fr));gap:1px}.month-row{height:12px}.month-row>strong{font-size:7px;line-height:12px}.calendar-rows{gap:1px}.month-row b{top:-4px}.candidate-calendar>p{font-size:8px}}
</style>
