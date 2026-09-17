<script setup lang="ts">
import { alignedDate, alignmentLabel } from '~/utils/crowdAlignment'
import { summarizeCrowds } from '~/utils/crowdSummary'
import { climateLabel, climateSource } from '~/utils/orlandoClimate'
definePageMeta({ layout: false })
useHead({ title: 'Crowd calendar · Orlando Planner' })
type Day = {
  date: string; rating: number; category: string; title: string; factors: string[]; regions: string
  breakdown: { base: number; season: number; school: number; holiday: number; combinedCalendar: number; weekday: number; raw: number }
  sourceComparison: Record<string, number>
  eveningEvents?: { name: string; fullName: string; park: string; status: string; note: string; referenceDate?: string; sourceUrl: string }[]
}
type Dataset = {
  version: string; generatedAt: string; start: string; end: string; days: Day[]
  resorts: { key: string; name: string; parks: { key: string; name: string; waterPark: boolean }[] }[]
}
// Public assets are served by Pages/the browser, outside Nitro's internal SSR router.
const { data, error, status } = await useFetch<Dataset>('/data/crowd-calendar.json', { server: false })
const years = [2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029]
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const labels = ['Low', 'Light', 'Moderate', 'Busy', 'High']
const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const todayKey = new Date().toISOString().slice(0, 10)
const month = ref('all')
const zoom = ref('day')
const alignment = ref('date')
const scope = ref('overall')
const selected = ref<Day | null>(null)
const search = ref('')
const tripRange = ref<{ start: string; end: string } | null>(null)
function tripClasses(day: Day) {
  return { 'trip-match': !!tripRange.value && day.date >= tripRange.value.start && day.date <= tripRange.value.end }
}
function highlightTrip(range: { start: string; end: string } | null) {
  tripRange.value = range
  if (range) { month.value = 'all'; search.value = '' }
}
const overlays = ref(['uk', 'festival', 'evening'])
const overlayOptions = [{ key: 'uk', label: '▰ UK school holidays' }, { key: 'festival', label: '◆ EPCOT festivals' }, { key: 'evening', label: '☾ Evening events' }, { key: 'weather', label: 'Typical weather' }]
function dayOverlays(day: Day) {
  const markers: { key: string; symbol: string; label: string }[] = []
  const uk = day.factors.filter(f => f.startsWith('UK schools:'))
  const festival = day.factors.filter(f => f.startsWith('EPCOT festival:'))
  if (overlays.value.includes('uk') && uk.length) markers.push({ key: 'uk', symbol: '▰', label: `${uk.join(', ')} · approximate` })
  const epcotVisible = scope.value === 'overall' || data.value?.resorts.some(r => r.parks.some(p => /epcot/i.test(p.name) && (scope.value === p.key || scope.value === r.key)))
  if (overlays.value.includes('festival') && festival.length && epcotVisible) markers.push({ key: 'festival', symbol: '◆', label: `${festival.join(', ')} · estimated window` })
  const events = eveningEvents(day)
  if (overlays.value.includes('evening') && events.length) markers.push({ key: 'evening', symbol: '☾', label: events.map(e => `${e.name} · ${e.status === 'Educated guess' ? 'guess' : 'source marker'}`).join('; ') })
  return markers
}
const index = computed(() => new Map(data.value?.days.map(d => [d.date, d]) ?? []))
const allDateRows = computed(() => months.flatMap((name, m) => {
  return Array.from({ length: new Date(Date.UTC(2024, m + 1, 0)).getUTCDate() }, (_, i) => {
    const key = `${String(m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
    return { key, label: `${i + 1} ${name.slice(0, 3)}`, days: years.map(y => index.value.get(`${y}-${key}`)) }
  })
}))
const dateRows = computed(() => allDateRows.value.filter(row => month.value === 'all' || Number(row.key.slice(0, 2)) === Number(month.value) + 1))
const weekRows = computed(() => Array.from({ length: 372 }, (_, i) => {
  const offset = i - 6
  return { key: `week-${offset}`, label: alignmentLabel(offset), days: years.map(year => {
    const date = alignedDate(year, offset)
    if (!date || (month.value !== 'all' && Number(date.slice(5, 7)) !== Number(month.value) + 1)) return undefined
    return index.value.get(date)
  }) }
}).filter(row => row.days.some(Boolean)))
const rows = computed(() => alignment.value === 'week' ? weekRows.value : dateRows.value)
const planningDays = computed(() => (data.value?.days ?? []).filter(day => day.date >= todayKey))
const planningMonthRows = computed(() => {
  const grouped = new Map<string, Day[]>()
  for (const day of planningDays.value) {
    const key = day.date.slice(0, 7)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(day)
  }
  return [...grouped.entries()].map(([key, days]) => {
    const [year, monthNumber] = key.split('-').map(Number)
    const cells: (Day | undefined)[] = Array(42).fill(undefined)
    const firstWeekday = new Date(Date.UTC(year!, monthNumber! - 1, 1)).getUTCDay()
    for (const day of days) cells[firstWeekday + Number(day.date.slice(8, 10)) - 1] = day
    return { key, label: `${months[monthNumber! - 1]} ${year}`, monthNumber: monthNumber! - 1, cells }
  }).filter(row => month.value === 'all' || row.monthNumber === Number(month.value))
})
const planningWeekRows = computed(() => {
  if (!data.value || !planningDays.value.length) return []
  const start = new Date(`${planningDays.value[0]!.date}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - start.getUTCDay())
  const end = data.value.end
  const result: { key: string; label: string; days: (Day | undefined)[] }[] = []
  for (let cursor = start; cursor.toISOString().slice(0, 10) <= end; cursor = new Date(cursor.getTime() + 7 * 86400000)) {
    const key = cursor.toISOString().slice(0, 10)
    const days = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(cursor.getTime() + offset * 86400000).toISOString().slice(0, 10)
      return date >= todayKey ? index.value.get(date) : undefined
    })
    if (days.some(day => day && (month.value === 'all' || Number(day.date.slice(5, 7)) === Number(month.value) + 1))) {
      result.push({ key, label: `Week of ${key}`, days })
    }
  }
  return result
})
const scopeLabel = computed(() => {
  for (const resort of data.value?.resorts ?? []) {
    if (resort.key === scope.value) return resort.name
    const park = resort.parks.find(p => p.key === scope.value)
    if (park) return park.name
  }
  return 'Overall Orlando'
})
function matches(day: Day) {
  return `${day.date} ${day.title} ${day.category} ${day.factors.join(' ')} ${eveningEvents(day).map(e => `${e.name} ${e.fullName}`).join(' ')}`.toLowerCase().includes(search.value.toLowerCase())
}
function eveningEvents(day: Day) {
  const resort = data.value?.resorts.find(r => r.key === scope.value)
  return (day.eveningEvents ?? []).filter(event => scope.value === 'overall' || event.park === scope.value || resort?.parks.some(p => p.key === event.park))
}
const matchingCount = computed(() => {
  if (zoom.value === 'planning' || zoom.value === 'planning-week') {
    return planningDays.value.filter(day => matches(day) && (month.value === 'all' || Number(day.date.slice(5, 7)) === Number(month.value) + 1)).length
  }
  return rows.value.flatMap(r => r.days).filter(d => d && matches(d)).length
})
const visibleRows = computed(() => rows.value.filter(row => !search.value || row.days.some(day => day && matches(day))))
const comparisons = computed(() => {
  if (!selected.value || !data.value) return []
  return data.value.resorts.filter(r => scope.value === 'overall' || r.key === scope.value || r.parks.some(p => p.key === scope.value))
    .flatMap(r => r.parks.filter(p => scope.value === 'overall' || r.key === scope.value || p.key === scope.value)
      .map(p => ({ name: p.name, value: selected.value?.sourceComparison[p.key] })))
})
const summaryYears = computed(() => years.map(year => {
  const yearDays = (data.value?.days ?? []).filter(day => day.date.startsWith(`${year}-`))
  const matching = yearDays.filter(day => matches(day) && (month.value === 'all' || Number(day.date.slice(5, 7)) === Number(month.value) + 1))
  return {
    year, summary: summarizeCrowds(matching),
    months: months.map((name, m) => {
      const all = yearDays.filter(day => Number(day.date.slice(5, 7)) === m + 1)
      const days = matching.filter(day => Number(day.date.slice(5, 7)) === m + 1)
      return { name, number: m, days, available: all.length, summary: summarizeCrowds(days) }
    }),
  }
}))
const heatmapRows = computed(() => allDateRows.value.map(row => ({
  ...row,
  monthStart: row.key.endsWith('-01'),
  monthLabel: row.key.endsWith('-01') ? months[Number(row.key.slice(0, 2)) - 1]!.slice(0, 3) : '',
})))
function heatmapVisible(day: Day) {
  return matches(day) && (month.value === 'all' || Number(day.date.slice(5, 7)) === Number(month.value) + 1)
}
function openHeatDay(day: Day) {
  selected.value = day
  month.value = String(Number(day.date.slice(5, 7)) - 1)
  search.value = day.date
  zoom.value = 'day'
}
function openPlanningDay(day: Day) {
  selected.value = day
  month.value = String(Number(day.date.slice(5, 7)) - 1)
  search.value = day.date
  zoom.value = 'day'
}
function exploreMonth(year: number, m: number) {
  month.value = String(m)
  search.value = `${year}-${String(m + 1).padStart(2, '0')}`
  zoom.value = 'day'
  selected.value = null
}
</script>

<template>
  <main class="crowds" :class="{ 'planning-mode': zoom === 'planning' || zoom === 'planning-week' }">
    <header class="hero">
      <nav class="hero-links"><NuxtLink to="/">← Trip planner</NuxtLink><NuxtLink to="/when-to-go">Find the best time to travel →</NuxtLink></nav>
      <div class="eyebrow">ORLANDO / CALENDAR LAB</div>
      <h1>A day for every kind of crowd.</h1>
      <p>Compare the calendar from 1 January 2022 to 31 January 2029. Choose a day to explore what shapes its estimate.</p>
      <div class="legend"><span v-for="(label, i) in labels" :key="label" :class="`level-${i + 1}`">{{ i + 1 }} · {{ label }}</span><strong>Provisional · low confidence</strong></div>
    </header>

    <div v-if="error" role="alert">The calendar could not be loaded. Please reload the page.</div>
    <p v-else-if="status === 'pending'">Loading calendar…</p>
    <template v-else-if="data">
      <div class="controls">
        <label>Zoom<select v-model="zoom"><option value="day">Day · detailed</option><option value="planning">Planning · month strips</option><option value="planning-week">Planning · detailed weeks</option><option value="month">Month · compare averages</option><option value="year">Year · daily heatmap</option></select></label>
        <label v-if="zoom === 'day'">Align by<select v-model="alignment"><option value="date">Calendar date</option><option value="week">Week number · Sunday first</option></select></label>
        <label>View<select v-model="scope"><option value="overall">Overall Orlando</option><optgroup v-for="r in data.resorts" :key="r.key" :label="r.name"><option :value="r.key">{{ r.name }} · resort</option><option v-for="p in r.parks" :key="p.key" :value="p.key">{{ p.name }}</option></optgroup></select></label>
        <label>Month<select v-model="month"><option value="all">All months</option><option v-for="(name, i) in months" :key="name" :value="String(i)">{{ name }}</option></select></label>
        <label class="search">Find a date or factor<input v-model="search" type="search" placeholder="Easter, UK schools, 2027-12…"></label>
        <span aria-live="polite">{{ matchingCount.toLocaleString() }} matching days</span>
      </div>
      <p class="notice"><strong>{{ scopeLabel }}</strong> · {{ scope === 'overall' ? 'An Orlando calendar baseline for expected queue pressure.' : 'Uses the shared Orlando baseline; park-specific crowd effects are not fitted yet. This is not an operating calendar.' }} Past dates are retrospective estimates, not observations. Weather is not scored.</p>
      <p v-if="zoom === 'month'" class="notice">Averages summarise the matching daily estimates, not measured crowds. Quiet days are rated 1–2; busy days 4–5. Select a month to open its days. Month and search filters apply; 2029 contains January only.</p>
      <p v-if="zoom === 'year'" class="notice">Every horizontal sliver is one calendar date. Month boundaries are marked down the side. Filters fade non-matching dates; select any sliver to open its detailed day.</p>
      <p v-if="zoom === 'planning' || zoom === 'planning-week'" class="notice">Planning runs from {{ todayKey }} to the final prediction on {{ data.end }}. Weeks start on Sunday. Select a day to open its complete rating, category, events and factors.</p>
      <TripWindowFinder v-if="zoom === 'planning' || zoom === 'planning-week'" :days="planningDays" @highlight="highlightTrip" />
      <p v-if="tripRange && (zoom === 'planning' || zoom === 'planning-week')" class="notice">Outlined stay: {{ tripRange.start }} → {{ tripRange.end }}. Crowd colours still show each day’s estimate.</p>
      <fieldset v-if="zoom === 'planning' || zoom === 'planning-week'" class="overlay-controls">
        <legend>Planning overlays</legend>
        <label v-for="option in overlayOptions" :key="option.key"><input v-model="overlays" type="checkbox" :value="option.key">{{ option.label }}</label>
        <p>Symbols add context to the crowd colours. UK breaks and festival windows are approximate; evening dates may be guesses. Event overlays follow your park selection.</p>
        <p v-if="overlays.includes('weather')">Typical high / low and monthly rainfall · Orlando Airport, 1991–2020 averages, not a daily forecast. <a :href="climateSource" target="_blank" rel="noopener noreferrer">Climate source</a></p>
      </fieldset>
      <section v-if="zoom === 'year'" class="year-heatmap" aria-label="Whole-year daily crowd heatmap">
        <div class="heat-head"><span>Day</span><strong v-for="year in years" :key="year">{{ year }}<small>{{ year === 2029 ? 'Jan only' : '' }}</small></strong></div>
        <div class="heat-body">
          <div v-for="row in heatmapRows" :key="row.key" class="heat-row" :class="{ 'month-start': row.monthStart }">
            <span class="heat-label">{{ row.monthLabel }}</span>
            <template v-for="(day, i) in row.days" :key="years[i]">
              <button v-if="day" class="heat-day" :class="[`level-${day.rating}`, { faded: !heatmapVisible(day) }]" :title="`${day.date} · ${day.rating}/5 ${labels[day.rating - 1]} · ${day.title}`" :aria-label="`${day.date}, ${day.rating} out of 5, ${day.title}. Open detailed day`" @click="openHeatDay(day)" />
              <span v-else class="heat-empty" />
            </template>
          </div>
        </div>
      </section>
      <section v-else-if="zoom === 'planning'" class="planning-overview" aria-label="Planning calendar by month">
        <div class="planning-toolbar"><strong>Month strips</strong><button @click="zoom = 'planning-week'">Zoom into detailed weeks →</button></div>
        <p class="mobile-plan-help">Each month is a complete Sunday-to-Saturday calendar. Tap a date to inspect it or switch to detailed weeks for easier day-by-day comparison.</p>
        <div class="planning-days" aria-hidden="true"><span>Month</span><template v-for="week in 6" :key="week"><small v-for="weekday in weekdayLabels" :key="`${week}-${weekday}`">{{ weekday.slice(0, 1) }}</small></template></div>
        <div v-for="row in planningMonthRows" :key="row.key" class="planning-month-row">
          <strong>{{ row.label }}<small v-if="overlays.includes('weather')" class="climate-note">{{ climateLabel(row.monthNumber) }}</small></strong>
          <template v-for="(day, i) in row.cells" :key="i">
            <button v-if="day" class="planning-sliver" :class="[tripClasses(day), `level-${day.rating}`, { faded: !matches(day) }]" :title="`${day.date} · ${day.rating}/5 · ${day.title}. ${dayOverlays(day).map(m => m.label).join('; ')}`" :aria-label="`${day.date}, ${day.rating} out of 5, ${day.title}. ${dayOverlays(day).map(m => m.label).join('; ')}. Open detailed day`" @click="openPlanningDay(day)"><span>{{ Number(day.date.slice(8, 10)) }}</span><CrowdOverlays :markers="dayOverlays(day)" /></button>
            <span v-else class="planning-empty" />
          </template>
        </div>
        <p v-if="!planningMonthRows.length" class="empty">No future predictions match this month.</p>
      </section>
      <section v-else-if="zoom === 'planning-week'" class="planning-weeks" aria-label="Detailed planning calendar by week">
        <div class="planning-toolbar"><strong>Detailed weeks</strong><button @click="zoom = 'planning'">← Zoom out to month strips</button></div>
        <p class="mobile-plan-help">Scroll through one week at a time. Each day includes the signals most useful when choosing trip dates.</p>
        <div class="week-head"><span>Week</span><strong v-for="weekday in weekdayLabels" :key="weekday">{{ weekday }}</strong></div>
        <div v-for="week in planningWeekRows" :key="week.key" class="planning-week-row">
          <strong>{{ week.label }}</strong>
          <div class="planning-week-days">
            <template v-for="(day, i) in week.days" :key="i">
              <button v-if="day" class="planning-day" :class="[tripClasses(day), `level-${day.rating}`, { faded: !matches(day) || (month !== 'all' && Number(day.date.slice(5, 7)) !== Number(month) + 1) }]" @click="openPlanningDay(day)">
                <span>{{ weekdayLabels[i] }} · {{ day.date.slice(8, 10) }} {{ months[Number(day.date.slice(5, 7)) - 1]!.slice(0, 3) }}</span>
                <strong>{{ day.rating }}<small>/5 · {{ labels[day.rating - 1] }}</small></strong>
                <b>{{ day.title }}</b>
                <CrowdOverlays :markers="dayOverlays(day)" detailed />
                <small v-if="overlays.includes('weather')" class="climate-note">Typical {{ climateLabel(Number(day.date.slice(5, 7)) - 1) }}</small>
                <small>{{ day.factors.filter(f => !f.startsWith('Season:') && !f.startsWith('Day:')).slice(0, 3).join(' · ') }}</small>
              </button>
              <span v-else class="planning-week-empty">{{ weekdayLabels[i] }} · outside prediction range</span>
            </template>
          </div>
        </div>
        <p v-if="!planningWeekRows.length" class="empty">No future predictions match this month.</p>
      </section>
      <section v-else-if="zoom === 'month'" class="month-overview" tabindex="0" aria-label="Month comparison">
        <table class="month-table">
          <caption class="sr-only">Average crowd estimates for each month and year, with quiet and busy day counts.</caption>
          <thead><tr><th scope="col">Month</th><th v-for="year in years" :key="year" scope="col">{{ year }}<small>{{ year === 2029 ? 'January only' : 'Full year' }}</small></th></tr></thead>
          <tbody><tr v-for="(name, m) in months" :key="name"><th scope="row">{{ name.slice(0, 3) }}</th><td v-for="year in summaryYears" :key="year.year">
            <button v-if="year.months[m]?.summary" class="month-cell" :class="`level-${year.months[m]!.summary!.level}`" :aria-label="`Explore ${name} ${year.year}, average ${year.months[m]!.summary!.average.toFixed(1)} out of 5`" @click="exploreMonth(year.year, m)">
              <strong>{{ year.months[m]!.summary!.average.toFixed(1) }}<small>/5</small></strong>
              <span>{{ year.months[m]!.summary!.quiet }} quiet · {{ year.months[m]!.summary!.busy }} busy</span>
              <small>{{ year.months[m]!.summary!.count }} matching days</small>
            </button><span v-else class="empty">{{ year.months[m]?.available ? 'Filtered out' : '—' }}</span>
          </td></tr></tbody>
        </table>
      </section>
      <p v-if="zoom === 'day' && alignment === 'week'" class="notice">Week 1 begins on each year's first Sunday. Week 0 preserves January dates before that Sunday. These are Sunday-start comparison weeks, not ISO weeks. Month filters keep each date in its original aligned row.</p>
      <div v-if="zoom === 'day'" class="workspace">
        <div class="grid-scroll" tabindex="0" aria-label="Crowd calendar; scroll to explore all dates and years">
          <table>
            <caption class="sr-only">{{ alignment === 'week' ? 'Crowd estimates aligned by Sunday-start week number and weekday.' : 'Crowd estimates by month and day. 29 February is blank in non-leap years.' }} Years run across the columns.</caption>
            <thead><tr><th scope="col">Day</th><th v-for="year in years" :key="year" scope="col">{{ year }}<small>{{ year === 2029 ? 'January only' : 'Full year' }}</small></th></tr></thead>
            <tbody><tr v-for="row in visibleRows" :key="row.key"><th scope="row">{{ row.label }}</th><td v-for="(day, i) in row.days" :key="years[i]">
              <button v-if="day" class="day" :class="[`level-${day.rating}`, { dimmed: !matches(day), chosen: selected?.date === day.date }]" :aria-label="`${day.date}, ${day.rating} out of 5, ${day.title}. View factors`" :aria-pressed="selected?.date === day.date" @click="selected = day">
                <span class="date">{{ day.date.slice(8) }}/{{ day.date.slice(5, 7) }}/{{ day.date.slice(0, 4) }}</span>
                <strong class="rating">{{ day.rating }}<small>/5 · {{ labels[day.rating - 1] }}</small></strong>
                <span class="category">{{ day.title }}</span>
                <span v-for="event in eveningEvents(day)" :key="event.name" class="event-badge">{{ event.name }} · {{ event.status === 'Educated guess' ? 'guess' : 'source marker' }}</span>
                <span class="badges"><span v-for="factor in day.factors.filter(f => !f.startsWith('Season:') && !f.startsWith('Day:')).slice(0, 3)" :key="factor">{{ factor }}</span><span v-if="day.factors.length > 5">+{{ day.factors.length - 5 }} more</span></span>
              </button>
              <span v-else class="empty">{{ row.key === '02-29' && years[i] !== 2028 ? 'No leap day' : '—' }}</span>
            </td></tr></tbody>
          </table>
          <p v-if="!matchingCount" role="status">No matching dates. Try another search or select all months.</p>
        </div>
        <aside aria-label="Day details" aria-live="polite">
          <template v-if="selected">
            <div class="detail-top"><span class="eyebrow">DAY DETAILS</span><button aria-label="Close day details" @click="selected = null">×</button></div>
            <h2>{{ selected.title }}</h2><p>{{ selected.date }} · {{ scopeLabel }}</p>
            <div class="detail-rating" :class="`level-${selected.rating}`">{{ selected.rating }}/5 · {{ labels[selected.rating - 1] }}<small>Provisional calendar estimate</small></div>
            <h3>Reusable category</h3><code>{{ selected.category }}</code>
            <h3>Planning overlays</h3><CrowdOverlays :markers="dayOverlays(selected)" detailed />
            <template v-if="overlays.includes('weather')"><h3>Typical weather</h3><p>{{ climateLabel(Number(selected.date.slice(5, 7)) - 1) }}</p><p class="muted">Monthly average high / low and rainfall, not a daily forecast. <a :href="climateSource" target="_blank" rel="noopener noreferrer">Orlando Airport · 1991–2020 normals</a></p></template>
            <h3>Evening events</h3>
            <p v-if="!eveningEvents(selected).length" class="muted">No event marker or guess for this selection. This does not establish that no event runs.</p>
            <div v-for="event in eveningEvents(selected)" :key="event.name" class="event-detail">
              <strong>{{ event.fullName }} · {{ event.park }}</strong><p>{{ event.status }}{{ event.status === 'Educated guess' ? ' · low confidence' : '' }}</p>
              <p>{{ event.note }}</p><p v-if="event.referenceDate">Reference night: {{ event.referenceDate }}</p>
              <a :href="event.sourceUrl" target="_blank" rel="noopener noreferrer">Source calendar data</a>
            </div>
            <p class="muted">Event nights are separate from daytime queue pressure. These markers do not set opening hours or adjust the crowd rating.</p>
            <h3>Calendar factors</h3><ul><li v-for="factor in selected.factors" :key="factor">{{ factor }}</li></ul>
            <p v-if="selected.regions">US regions: {{ selected.regions }}</p>
            <p class="muted">School breaks and event windows are approximate recurring rules. Events and festivals are context only; they do not adjust this score.</p>
            <h3>How this score is calculated</h3>
            <p>Base {{ selected.breakdown.base }} + calendar {{ selected.breakdown.combinedCalendar }} + weekday {{ selected.breakdown.weekday }} = {{ selected.breakdown.raw }}. Rounded and limited to 1–5.</p>
            <p class="muted">Season {{ selected.breakdown.season }}, schools {{ selected.breakdown.school }}, holiday {{ selected.breakdown.holiday }}. Use the strongest positive signal plus any quiet-season reduction.</p>
            <h3>Imported park predictions</h3><p class="muted">Separate source estimates on a 1–10 scale, including past dates. Not used to fit our rating. Pre-opening Epic records excluded.</p>
            <ul><li v-for="p in comparisons" :key="p.name">{{ p.name }}: <strong>{{ p.value != null ? `${p.value}/10` : 'No source score' }}</strong></li></ul>
          </template>
          <template v-else><span class="eyebrow">READ THE CALENDAR</span><h2>{{ alignment === 'week' ? 'Same weekday. Different year.' : 'Same date. Different year.' }}</h2><p>{{ alignment === 'week' ? 'First Sundays align in week 1, followed by Mondays, Tuesdays and the rest of each week.' : 'The rows align by month and day, so you can compare changing weekdays and holidays.' }}</p><p>Select any square for all its factors, its reusable category code and the score calculation.</p></template>
          <hr><h3>Still to add</h3><p class="muted">Confirmed school calendars, actual event nights, weather, operating capacity, pricing and pass restrictions. Individual ride ratings need ride-level data.</p><p class="muted">Model: {{ data.version }}. All resort and park views currently inherit this baseline; closed or not-yet-open parks may appear, without an operating-status claim.</p>
        </aside>
      </div>
    </template>
  </main>
</template>

<style scoped>
.overlay-controls{border:1px solid #d8ded3;border-radius:10px;padding:12px;margin:16px 0;display:flex;flex-wrap:wrap;gap:10px 18px;background:#fffdf8}
.overlay-controls legend{font-weight:700;font-size:13px;padding:0 6px}
.overlay-controls label{display:flex;align-items:center;gap:7px;min-height:36px;font-size:13px;cursor:pointer}
.overlay-controls input{accent-color:#244f48;width:17px;height:17px}
.overlay-controls p{flex-basis:100%;font-size:12px;line-height:1.5;margin:0;color:#52665f}
.planning-sliver{flex-direction:column}
.planning-month-row>strong{flex-direction:column;justify-content:center;align-items:flex-start!important;gap:4px}
.climate-note{display:block;font-size:10px;font-weight:500;line-height:1.4}
.planning-sliver :deep(.overlay-markers){font-size:6px;gap:0;line-height:10px}
@media(max-width:700px){.planning-day>.overlay-markers{grid-column:2}.planning-sliver :deep(.overlay-markers){font-size:10px;gap:3px;line-height:14px}.overlay-controls{gap:4px 12px}.overlay-controls label{font-size:12px;min-height:44px}}
.crowds{position:fixed;inset:0;overflow:auto;background:#faf8f2;color:#233a38;padding:28px;font-family:var(--font-ui)}
.hero{max-width:1000px}.hero-links{display:flex;justify-content:space-between;gap:12px}.hero-links a{font-size:13px;color:#355b55}.eyebrow{font-size:11px;font-weight:700;letter-spacing:.15em;margin:22px 0 10px}h1{font:700 clamp(28px,4vw,48px)/1.1 var(--font-display);margin:0 0 14px}p{font-size:14px;line-height:1.6;margin:10px 0}h2{font:700 25px/1.15 var(--font-display);margin:12px 0}h3{font-size:13px;margin:22px 0 8px}.legend{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:22px 0}.legend span{padding:8px 13px;border-radius:6px;font-size:12px}.legend strong{font-size:12px;margin-left:8px}.level-1{background:#d9eee7;color:#214d40}.level-2{background:#e7efd1;color:#40502c}.level-3{background:#fae7b4;color:#665022}.level-4{background:#f5c99e;color:#6a3922}.level-5{background:#e9aaa0;color:#672d2b}.controls{display:flex;align-items:end;gap:16px;flex-wrap:wrap;border-top:1px solid #dcded4;padding-top:20px}label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600}select,input{font:inherit;color:inherit;padding:11px;border:1px solid #c9d1c8;border-radius:7px;background:white;max-width:320px}.search{flex:1}.search input{max-width:none}.controls>span{font-size:12px;padding-bottom:12px}.notice{font-size:12px;max-width:1100px;margin:18px 0}.workspace{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:22px}.grid-scroll{overflow:auto;height:72vh;border:1px solid #d8ded3;border-radius:10px;background:#fffdf8}table{border-collapse:separate;border-spacing:5px;width:100%;table-layout:fixed;min-width:1320px}th{font-size:12px;text-align:left}thead th{position:sticky;top:0;background:#fffdf8;z-index:2;padding:14px 8px;font-size:19px}thead small{display:block;font-size:10px;font-weight:400;margin-top:4px}th:first-child{width:62px;position:sticky;left:0;background:#fffdf8;z-index:1;padding-left:5px}thead th:first-child{z-index:3;font-size:12px}td{padding:0;vertical-align:top}.day{display:flex;flex-direction:column;width:100%;min-height:183px;height:100%;padding:11px;border:2px solid transparent;border-radius:7px;text-align:left;cursor:pointer;transition:opacity .15s}.day:hover{border-color:#57736c}.day:focus-visible,.chosen{outline:3px solid #244f48;outline-offset:-3px}.date{font-size:11px}.rating{font-size:27px;display:block;margin:9px 0 4px}.rating small{font-size:11px;margin-left:3px;font-weight:500}.category{font-size:12px;font-weight:600;margin-bottom:12px}.badges{margin-top:auto;display:flex;gap:3px;flex-wrap:wrap;font-size:9px;line-height:1.4}.badges span{background:#ffffff70;border-radius:3px;padding:3px 4px}.dimmed{opacity:.22}.empty{display:block;color:#929a91;font-size:11px;padding:15px}.detail-top{display:flex;justify-content:space-between;align-items:center}.detail-top button{font-size:25px;background:none;border:0;cursor:pointer}aside{overflow:auto;max-height:72vh;background:white;border:1px solid #d8ded3;border-radius:10px;padding:20px}aside .eyebrow{margin-top:0}aside p,aside li{font-size:12px}aside ul{padding-left:17px;line-height:1.7}code{font-size:11px;overflow-wrap:anywhere}.muted{color:#66736a}.detail-rating{padding:16px;border-radius:7px;font-size:22px;font-weight:700}.detail-rating small{display:block;font-size:11px;font-weight:400;margin-top:5px}hr{border:0;border-top:1px solid #e1e5dc;margin-top:24px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
@media(max-width:900px){.crowds{padding:18px}.workspace{grid-template-columns:1fr}aside{max-height:none}.grid-scroll{height:65vh}.controls label{flex:1;min-width:140px}select{width:100%;max-width:none}}
</style>

<style scoped>
.event-badge{display:block;font-size:10px;font-weight:600;border-left:3px solid #685286;padding:4px 6px;background:#ffffffa0;margin-bottom:5px;border-radius:3px}
.event-detail{border:1px solid #ded5e8;border-radius:6px;padding:10px;margin-bottom:10px;font-size:12px}
.event-detail a{color:#54406f}
</style>

<style scoped>
.year-heatmap{background:#fffdf8;border:1px solid #d8ded3;border-radius:10px;padding:12px 14px 14px;overflow:hidden}
.heat-head,.heat-row{display:grid;grid-template-columns:52px repeat(8,minmax(55px,1fr));column-gap:5px}.heat-head{align-items:end;height:38px;padding-bottom:7px}.heat-head>span{font-size:11px;font-weight:700}.heat-head strong{text-align:center;font-size:16px}.heat-head small{display:block;font-size:8px;font-weight:400;color:#66736a}
.heat-body{height:min(670px,70vh);display:grid;grid-template-rows:repeat(366,minmax(1px,1fr));gap:0}.heat-row{min-height:0;position:relative}.heat-row.month-start{border-top:1px solid #60716c}.heat-label{position:relative;top:-1px;z-index:1;background:transparent;font-size:9px;font-weight:700;line-height:11px;color:#455b56}.month-start .heat-label{background:#fffdf8}.heat-day,.heat-empty{display:block;width:100%;min-width:0;height:100%;min-height:1px;border:0;border-radius:0;padding:0}.heat-day{cursor:pointer}.heat-day:hover{outline:2px solid #183f39;outline-offset:0;z-index:2}.heat-day:focus-visible{outline:3px solid #183f39;z-index:3}.heat-day.faded{opacity:.12}.heat-empty{background:#f0efe9}
.month-cell:hover{outline:2px solid #57736c}.month-cell:focus-visible{outline:3px solid #244f48;outline-offset:2px}
.month-overview{overflow:auto;border:1px solid #d8ded3;border-radius:10px;background:#fffdf8;max-height:75vh}.month-table{min-width:850px}.month-table th:first-child{width:65px}.month-table thead th{font-size:17px}.month-cell{width:100%;border:0;border-radius:6px;padding:10px;text-align:left;display:flex;flex-direction:column;gap:5px;cursor:pointer}.month-cell>strong{font-size:22px}.month-cell strong small{font-size:11px;font-weight:400}.month-cell>span{font-size:10px}.month-cell>small{font-size:9px;opacity:.8}
.planning-overview,.planning-weeks{overflow:auto;border:1px solid #d8ded3;border-radius:10px;background:#fffdf8;padding:12px;max-height:72vh}.planning-toolbar{position:sticky;left:0;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;min-width:950px}.planning-toolbar button{border:1px solid #9daea8;border-radius:6px;background:white;color:#244f48;padding:8px 11px;font:600 11px var(--font-ui);cursor:pointer}.planning-days,.planning-month-row{display:grid;grid-template-columns:105px repeat(42,minmax(20px,1fr));gap:2px;min-width:1050px}.planning-days{position:sticky;top:0;z-index:3;background:#fffdf8;padding:4px 0 7px}.planning-days>span{font-size:10px;font-weight:700}.planning-days small{text-align:center;font-size:8px;color:#66736a}.planning-month-row{min-height:34px;margin-bottom:4px}.planning-month-row>strong{position:sticky;left:0;z-index:2;background:#fffdf8;display:flex;align-items:center;font-size:11px}.planning-sliver,.planning-empty{display:flex;align-items:center;justify-content:center;min-width:0;border:0;border-radius:2px;padding:0}.planning-sliver{cursor:pointer;color:inherit}.planning-sliver span{font-size:8px}.planning-sliver:hover,.planning-sliver:focus-visible{outline:2px solid #183f39;z-index:2}.planning-empty{background:#f1f0eb}.planning-sliver.faded{opacity:.12}
.week-head,.planning-week-row{display:grid;grid-template-columns:105px minmax(0,1fr);gap:5px;min-width:990px}.week-head{grid-template-columns:105px repeat(7,minmax(118px,1fr));position:sticky;top:0;z-index:3;background:#fffdf8;padding:5px 0 8px}.week-head span{font-size:10px;font-weight:700}.week-head strong{text-align:center;font-size:12px}.planning-week-row{margin-bottom:6px}.planning-week-row>strong{position:sticky;left:0;z-index:2;background:#fffdf8;padding:9px 5px;font-size:10px}.planning-week-days{display:grid;grid-template-columns:repeat(7,minmax(118px,1fr));gap:5px}.planning-day{min-height:128px;border:0;border-radius:6px;padding:9px;text-align:left;display:flex;flex-direction:column;gap:5px;color:inherit;cursor:pointer}.planning-day>span{font-size:10px}.planning-day>strong{font-size:22px}.planning-day>strong small{font-size:9px;font-weight:500}.planning-day>b{font-size:10px}.planning-day>em{font-size:8px;font-style:normal;border-left:2px solid #685286;padding-left:4px}.planning-day>small{font-size:8px;line-height:1.35;margin-top:auto}.planning-day:hover,.planning-day:focus-visible{outline:2px solid #183f39}.planning-week-empty{display:flex;align-items:center;justify-content:center;background:#f1f0eb;color:#929a91;border-radius:6px;font-size:9px;text-align:center;padding:8px}.planning-day.faded{opacity:.12}.mobile-plan-help{display:none}
@media(max-width:700px){
  .planning-mode{padding:14px}.planning-mode .hero .eyebrow,.planning-mode .hero>p{display:none}.planning-mode .hero h1{font-size:28px;margin-top:8px}.planning-mode .legend{margin:12px 0}.planning-mode .legend span{padding:6px 8px;font-size:10px}.planning-mode .legend strong{width:100%;margin:0}.planning-mode .controls{gap:10px;padding-top:14px}.planning-mode .controls label{min-width:calc(50% - 5px)}.planning-mode .controls .search{min-width:100%}.planning-mode .notice{margin:12px 0}
  .planning-overview,.planning-weeks{max-height:none;padding:10px;overflow:visible}.planning-toolbar{min-width:0;position:static;gap:10px}.planning-toolbar button{padding:8px;font-size:10px}.mobile-plan-help{display:block;font-size:11px;color:#66736a;margin:0 0 12px}
  .planning-days,.planning-month-row{min-width:0;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px}.planning-days{top:0;padding:7px 0}.planning-days>span{display:none}.planning-days small:nth-of-type(n+8){display:none}.planning-days small{font-size:9px}.planning-month-row{padding:9px 0 12px;border-top:1px solid #d8ded3;margin:0}.planning-month-row>strong{position:static;grid-column:1/-1;padding:0 0 5px;font-size:13px}.planning-sliver,.planning-empty{aspect-ratio:1;min-height:36px;border-radius:4px}.planning-sliver span{font-size:10px;font-weight:600}
  .week-head{display:none}.planning-week-row{display:block;min-width:0;margin:0 0 18px;border-top:1px solid #d8ded3;padding-top:10px}.planning-week-row>strong{position:static;display:block;padding:0 0 8px;font-size:12px}.planning-week-days{grid-template-columns:1fr;gap:6px}.planning-day{min-height:0;padding:12px;display:grid;grid-template-columns:minmax(82px,.7fr) minmax(0,1.3fr);column-gap:12px;row-gap:4px}.planning-day>span,.planning-day>strong{grid-column:1}.planning-day>b,.planning-day>em,.planning-day>small{grid-column:2}.planning-day>strong{font-size:24px}.planning-day>b{font-size:11px}.planning-day>em,.planning-day>small{font-size:9px}.planning-week-empty{min-height:45px}
}
</style>

<style scoped>
.planning-sliver.trip-match,.planning-day.trip-match{box-shadow:inset 0 0 0 2px #183f39;position:relative}.planning-sliver.trip-match{outline:1px solid #183f39;outline-offset:-1px}
</style>
