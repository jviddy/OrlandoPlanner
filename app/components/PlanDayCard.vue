<script setup lang="ts">
import { parkName } from '~/data/parks'
import { parseISO, useDates } from '~/composables/useDates'

const props = defineProps<{ index: number; selected?: boolean }>()
const emit = defineEmits<{ select: []; change: []; details: [] }>()
const store = useTripStore()
const { dowDayMon, time12 } = useDates()

const day = computed(() => store.days[props.index]!)
const activity = computed(() =>
  [day.value.parkId, day.value.secondParkId]
    .filter((id): id is string => Boolean(id))
    .map((id) => parkName(id, store.customActivities))
    .join(' + ') || 'Day not set',
)
const hotels = computed(() => store.hotelsForDate(day.value.date))
const flights = computed(() => store.flights.filter((flight) => flight.date === day.value.date))
const warningCount = computed(() => day.value.items.filter(
  (item) => item.parkId && item.parkId !== day.value.parkId && item.parkId !== day.value.secondParkId,
).length)
</script>

<template>
  <article class="plan-card" :class="{ 'plan-card--selected': selected }" @click="emit('select')">
    <header class="plan-card__head">
      <div><p>Day {{ index + 1 }}</p><h2>{{ dowDayMon(parseISO(day.date)) }}</h2></div>
      <DayCircle :park-id="day.parkId" :second-park-id="day.secondParkId" :date-number="parseISO(day.date).getUTCDate()" :size="56" />
    </header>

    <section class="plan-card__activity">
      <span class="group-label">Plan</span><strong>{{ activity }}</strong>
      <button type="button" @click.stop="emit('change')">Change day</button>
    </section>

    <div v-if="hotels.length || flights.length" class="plan-card__anchors">
      <p v-for="hotel in hotels" :key="hotel"><AppIcon name="bed" :size="14" /> {{ hotel }}</p>
      <p v-for="flight in flights" :key="flight.id"><AppIcon name="plane" :size="14" /> {{ flight.route || 'Flight' }}<span v-if="flight.departTime"> · {{ time12(flight.departTime) }}</span></p>
    </div>

    <div v-if="warningCount" class="plan-card__warning"><AppIcon name="warn" :size="15" /> {{ warningCount }} booking {{ warningCount === 1 ? 'conflict' : 'conflicts' }}</div>

    <section class="plan-card__details">
      <span class="group-label">Bookings & ideas</span>
      <p v-if="!day.items.length" class="plan-card__empty">Nothing added yet</p>
      <div v-for="item in day.items" :key="item.id" class="plan-card__item">
        <time>{{ item.time ? time12(item.time) : 'Any time' }}</time><span>{{ item.title }}</span><small v-if="item.anchor === 'date'">Fixed</small>
      </div>
    </section>

    <p v-if="day.note" class="plan-card__note">{{ day.note }}</p>
    <button type="button" class="plan-card__open" @click.stop="emit('details')">Open day details <span aria-hidden="true">→</span></button>
  </article>
</template>

<style scoped>
.plan-card { width:min(100%, 420px); min-height:430px; display:flex; flex-direction:column; gap:15px; padding:18px; border:1.5px solid var(--warm-border); border-radius:20px; background:#fff; box-shadow:var(--sh-week); text-align:left; }
.plan-card--selected { border-color:var(--c-navy); box-shadow:0 0 0 2px rgb(19 39 74 / 12%), var(--sh-week); }
.plan-card__head { display:flex; align-items:center; justify-content:space-between; gap:14px; }
.plan-card__head p { color:var(--text-faint); font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
.plan-card__head h2 { margin-top:3px; font:700 22px/1.1 var(--font-display); color:var(--text); }
.plan-card__activity { display:grid; grid-template-columns:1fr auto; gap:5px 10px; padding:14px; border-radius:var(--r-card); background:var(--sand); }
.plan-card__activity .group-label { grid-column:1 / -1; }
.plan-card__activity strong { min-width:0; font-size:15px; color:var(--text); }
.plan-card__activity button { color:var(--c-navy); font-size:12px; font-weight:700; }
.plan-card__anchors { display:flex; flex-direction:column; gap:7px; padding-bottom:13px; border-bottom:1px solid var(--warm-rule); }
.plan-card__anchors p { display:flex; align-items:center; gap:7px; color:var(--text-muted); font-size:12px; }
.plan-card__warning { display:flex; align-items:center; gap:7px; padding:9px 10px; border-radius:var(--r-alert); background:var(--warn-bg); color:var(--warn-ink); font-size:12px; font-weight:700; }
.plan-card__details { display:flex; flex-direction:column; gap:7px; }
.plan-card__empty { color:var(--text-faint); font-size:12px; }
.plan-card__item { display:grid; grid-template-columns:64px minmax(0, 1fr) auto; gap:7px; align-items:baseline; font-size:12px; }
.plan-card__item time { color:var(--text-faint); font-size:11px; }
.plan-card__item span { color:var(--text); font-weight:600; }
.plan-card__item small { padding:3px 6px; border-radius:var(--r-pill); background:#eef0f3; color:var(--text-faint); font-size:9px; font-weight:700; text-transform:uppercase; }
.plan-card__note { padding:10px 12px; border-left:3px solid var(--warm-border); color:var(--text-muted); font-size:12px; line-height:1.45; }
.plan-card__open { display:flex; align-items:center; justify-content:space-between; margin-top:auto; padding-top:13px; border-top:1px solid var(--warm-rule); color:var(--c-navy); font-size:13px; font-weight:800; }
@media (min-width:760px) { .plan-card { width:340px; min-width:340px; } }
</style>
