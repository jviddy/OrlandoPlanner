<script setup lang="ts">
import type { SetupMode } from '~/types/trip'
import { useSetupStore } from '~/stores/setup'

useHead({ title: 'Set up your trip · Orlando Planner' })
const store = useTripStore()
const setup = useSetupStore()
const routeLabels: Record<SetupMode, string> = { self: "I know what I'm doing", booked: 'I have things booked', guided: 'Help me plan' }
const priorities = ['Disney parks', 'Universal parks', 'Rest days', 'Food', 'Shopping']
const facts = ['Flights', 'Hotels', 'Tickets', 'Dining', 'Tours or events']
const datesValid = computed(() => Boolean(setup.startDate && setup.endDate && setup.endDate >= setup.startDate))
const isReview = computed(() => setup.step === 3)

onMounted(() => { if (store.hasTrip) navigateTo('/', { replace: true }) })
function choose(mode: SetupMode) { setup.start(mode) }
function updateDates({ start, end }: { start: string; end: string }) { setup.startDate = start; setup.endDate = end }
function next() { if (setup.step !== 1 || datesValid.value) setup.step = Math.min(3, setup.step + 1) }
function back() { setup.step = Math.max(0, setup.step - 1) }

function commit() {
  if (!setup.mode || !datesValid.value) return
  store.resetTrip()
  store.updateFields({
    name: setup.name, startDate: setup.startDate, endDate: setup.endDate, weekStart: setup.weekStart,
    hotels: setup.hotels.map((hotel) => ({ ...hotel })), ticketDays: { ...setup.ticketDays },
    parkHopper: setup.parkHopper, flights: setup.flights.map((flight) => ({ ...flight })), carHire: setup.carHire,
    setupMode: setup.mode,
    seedStrategy: setup.mode === 'guided' ? 'generated' : setup.templateId === 'blank' ? 'blank' : 'template',
  })
  store.applyTemplate(setup.mode === 'guided' && setup.templateId === 'blank' ? 'both' : setup.templateId)
  const firstUnset = store.days.find((day) => !day.parkId) ?? store.days[0]
  setup.clear()
  navigateTo({ path: '/plan', query: firstUnset ? { day: firstUnset.id } : {} })
}
</script>

<template>
  <div class="screen setup">
    <ClientOnly>
      <div class="scroll setup__body">
        <header class="setup__head">
          <button v-if="setup.step > 0" type="button" class="linkback" @click="back">← Back</button>
          <p class="eyebrow">New trip<span v-if="setup.mode"> · {{ routeLabels[setup.mode] }}</span></p>
          <div v-if="setup.step > 0" class="setup__progress" aria-label="Setup progress"><span v-for="n in 3" :key="n" :class="{ on: n <= setup.step }" /></div>
        </header>

        <section v-if="setup.step === 0" class="setup__panel">
          <h1>How would you like to start?</h1>
          <p>Choose the route that matches what you know today. You can switch without losing shared details.</p>
          <button class="route-card" type="button" @click="choose('self')"><strong>I know what I'm doing</strong><span>Start with name and dates, then build the plan yourself.</span></button>
          <button class="route-card" type="button" @click="choose('booked')"><strong>I have things booked</strong><span>Add fixed facts first so the plan works around them.</span></button>
          <button class="route-card" type="button" @click="choose('guided')"><strong>Help me plan</strong><span>Tell us your pace and priorities, then review a suggested shape.</span></button>
        </section>

        <section v-else-if="setup.step === 1" class="setup__panel">
          <h1>Start with the trip</h1><p>Name and dates are the only required details.</p>
          <label class="field"><span>Trip name</span><input v-model="setup.name" class="input" placeholder="Florida 2027" /></label>
          <label class="field"><span>Dates</span><DateRangeField :start="setup.startDate" :end="setup.endDate" placeholder="Add your dates" sheet-title="Trip dates" @update="updateDates" /></label>
          <p class="setup__hint">Your progress is saved on this device.</p>
        </section>

        <section v-else-if="setup.step === 2 && setup.mode === 'self'" class="setup__panel">
          <h1>Choose a starting shape</h1><p>Blank is the default. You can apply a shape later from Overview or Plan.</p>
          <label v-for="option in [{id:'blank',name:'Blank trip'},{id:'disney',name:'First timer Disney'},{id:'both',name:'Disney + Universal'}]" :key="option.id" class="choice">
            <input v-model="setup.templateId" type="radio" :value="option.id" /><span>{{ option.name }}</span>
          </label>
        </section>

        <section v-else-if="setup.step === 2 && setup.mode === 'booked'" class="setup__panel setup__panel--wide">
          <h1>What do you already have?</h1><p>Select the facts you want to capture. Dates and locations help us flag conflicts later.</p>
          <div class="chip-row"><button v-for="fact in facts" :key="fact" type="button" :class="{ on: setup.bookedFacts.includes(fact) }" @click="setup.toggleFact(fact)">{{ fact }}</button></div>
          <TripDetailsFields :draft="setup" />
        </section>

        <section v-else-if="setup.step === 2 && setup.mode === 'guided'" class="setup__panel">
          <h1>Build your planning brief</h1>
          <label class="field"><span>Party</span><select v-model="setup.party" class="input"><option value="adults">Adults</option><option value="young-family">Family with young children</option><option value="mixed">Mixed ages</option></select></label>
          <label class="field"><span>Preferred pace</span><select v-model="setup.pace" class="input"><option value="relaxed">Relaxed, regular rest</option><option value="balanced">Balanced</option><option value="full">Full park days</option></select></label>
          <fieldset><legend>Priorities</legend><div class="chip-row"><button v-for="item in priorities" :key="item" type="button" :class="{ on: setup.priorities.includes(item) }" @click="setup.togglePriority(item)">{{ item }}</button></div></fieldset>
          <label class="field"><span>Accessibility or comfort needs</span><textarea v-model="setup.accessibility" class="input" rows="3" placeholder="Optional — mobility, sensory, heat or other needs" /></label>
          <p class="brief">We’ll suggest a balanced shape with rest between long park runs. It is a starting point based on these preferences, not a claim that one plan is best.</p>
        </section>

        <section v-else-if="isReview" class="setup__panel">
          <p class="eyebrow">Review before creating</p><h1>{{ setup.name || 'My Trip' }}</h1>
          <dl class="review"><div><dt>Dates</dt><dd>{{ setup.startDate }} → {{ setup.endDate }}</dd></div><div><dt>Route</dt><dd>{{ setup.mode ? routeLabels[setup.mode] : '' }}</dd></div><div><dt>Starting point</dt><dd>{{ setup.mode === 'guided' ? 'Suggested balanced shape' : setup.templateId }}</dd></div><div v-if="setup.mode === 'booked'"><dt>Existing facts</dt><dd>{{ setup.bookedFacts.join(', ') || 'None added yet' }}</dd></div><div v-if="setup.mode === 'guided'"><dt>Planning brief</dt><dd>{{ setup.pace }} pace · {{ setup.priorities.join(', ') || 'general mix' }}</dd></div></dl>
          <button type="button" class="setup__switch" @click="setup.step = 0">Choose a different route</button>
        </section>
      </div>

      <footer v-if="setup.step > 0" class="setup__foot">
        <button v-if="setup.step === 2" type="button" class="setup__skip" @click="next">Skip for now</button>
        <button v-if="!isReview" class="cta" :disabled="setup.step === 1 && !datesValid" @click="next">Continue</button>
        <button v-else class="cta" @click="commit">Create trip and open Plan</button>
      </footer>
      <template #fallback><div class="scroll" /></template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.setup { background:var(--paper); }.setup__body{padding-bottom:28px}.setup__head{padding:18px 20px 0}.setup__progress{display:flex;gap:5px;margin-top:10px}.setup__progress span{width:36px;height:4px;border-radius:9px;background:var(--warm-border)}.setup__progress span.on{background:var(--c-navy)}
.setup__panel{width:min(100%,600px);margin:0 auto;padding:20px;display:flex;flex-direction:column;gap:14px}.setup__panel--wide{width:min(100%,760px)}.setup__panel h1{margin:0;font-size:29px;line-height:1.1}.setup__panel>p{color:var(--text-muted);line-height:1.5}
.route-card{padding:17px;border:1.5px solid var(--warm-border);border-radius:var(--r-card);text-align:left;background:#fff;box-shadow:var(--sh-template)}.route-card strong,.route-card span{display:block}.route-card strong{font:700 17px var(--font-display)}.route-card span{margin-top:4px;color:var(--text-muted);font-size:13px;line-height:1.4}
.choice{display:flex;gap:10px;padding:14px;border:1px solid var(--warm-border);border-radius:var(--r-row);font-weight:600}.chip-row{display:flex;flex-wrap:wrap;gap:7px}.chip-row button{padding:8px 11px;border-radius:var(--r-pill);background:#f1f3f7;color:var(--text-muted);font-size:13px}.chip-row button.on{background:var(--c-navy);color:#fff}.setup__hint{font-size:12px}.brief{padding:12px;border-radius:var(--r-row);background:#edf5ef;font-size:13px}fieldset{border:0;padding:0}legend{margin-bottom:8px;font-size:13px;font-weight:700}
.review{margin:0}.review div{padding:11px 0;border-bottom:1px solid var(--warm-rule)}.review dt{font-size:11px;text-transform:uppercase;color:var(--text-faint);font-weight:700}.review dd{margin:3px 0 0;color:var(--text)}.setup__switch{align-self:flex-start;color:var(--c-navy);font-weight:700;font-size:13px}
.setup__foot{flex:none;display:flex;gap:12px;padding:12px 20px max(26px,env(safe-area-inset-bottom));border-top:1px solid var(--warm-rule);background:var(--paper)}.setup__foot .cta{flex:1}.setup__skip{color:var(--text-muted);font-weight:700}.setup__panel :deep(.tdf__required){display:none}.setup__panel :deep(.tdf__optional){padding-inline:0}
</style>
