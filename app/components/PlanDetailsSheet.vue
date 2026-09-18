<script setup lang="ts">
import { parkName } from '~/data/parks'
import { parseISO, useDates } from '~/composables/useDates'
import type { DayItem, ItemKind } from '~/types/trip'

type InitialAction = 'booking' | 'idea' | 'edit'

const props = defineProps<{ index: number; initialAction: InitialAction }>()
const emit = defineEmits<{ close: []; changeDay: [] }>()
const store = useTripStore()
const { dowDayMon, time12 } = useDates()

const day = computed(() => store.days[props.index]!)
const adding = ref<ItemKind | null>(null)
const editingId = ref<string | null>(null)
const noteDraft = ref(day.value.note)
const discardPrompt = ref(false)
let previousFocus: HTMLElement | null = null

const fixedItems = computed(() => day.value.items.filter((item) => item.anchor === 'date'))
const movableItems = computed(() => day.value.items.filter((item) => item.anchor === 'plan'))
const hotels = computed(() => store.hotelsForDate(day.value.date))
const flights = computed(() => store.flights.filter((flight) => flight.date === day.value.date))
const hasUnsaved = computed(() => Boolean(
  adding.value || editingId.value || noteDraft.value !== day.value.note,
))

const warnings = computed(() => {
  const list: Array<{ id: string; text: string; action: 'change' | 'settings' }> = []
  for (const item of day.value.items) {
    if (item.parkId && item.parkId !== day.value.parkId && item.parkId !== day.value.secondParkId) {
      list.push({
        id: `park-${item.id}`,
        text: `${item.title} is at ${parkName(item.parkId, store.customActivities)}, outside this day's plan.`,
        action: 'change',
      })
    }
  }
  if (day.value.secondParkId && !store.parkHopper) {
    list.push({ id: 'hopper', text: 'This day uses two parks, but the trip is not marked as park hopper.', action: 'settings' })
  }
  if (day.value.parkId === 'travel' && fixedItems.value.length) {
    list.push({ id: 'travel', text: 'This travel day also has a date-fixed booking. Check that the timing works.', action: 'change' })
  }
  const disneyOver = store.ticketDays.disney > 0 && store.disneyDays > store.ticketDays.disney
  const universalOver = store.ticketDays.universal > 0 && store.universalDays > store.ticketDays.universal
  if (disneyOver || universalOver) {
    const names = [disneyOver ? 'Disney' : '', universalOver ? 'Universal' : ''].filter(Boolean).join(' and ')
    list.push({ id: 'tickets', text: `${names} plans currently exceed the ticket-day total.`, action: 'change' })
  }
  return list
})

function begin(action: InitialAction) {
  adding.value = action === 'booking' ? 'fixed' : action === 'idea' ? 'idea' : null
}
function saveNew(value: Omit<DayItem, 'id'>) {
  store.addItem(props.index, value)
  adding.value = null
}
function saveEdit(id: string, value: Omit<DayItem, 'id'>) {
  store.updateItem(props.index, id, value)
  editingId.value = null
}
function removeItem(id: string) {
  store.removeItem(props.index, id)
  editingId.value = null
}
function saveNote() {
  store.setDayNote(props.index, noteDraft.value)
}
function requestClose() {
  if (hasUnsaved.value) discardPrompt.value = true
  else emit('close')
}
function discardAndClose() {
  discardPrompt.value = false
  emit('close')
}
function changeDay() {
  if (hasUnsaved.value) {
    discardPrompt.value = true
    return
  }
  emit('changeDay')
}
function openSettings() {
  if (hasUnsaved.value) {
    discardPrompt.value = true
    return
  }
  navigateTo('/edit')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') requestClose()
  if (event.key !== 'Tab') return
  const panel = document.querySelector<HTMLElement>('.detail-panel')
  const focusable = panel ? [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')] : []
  if (!focusable.length) return
  const first = focusable[0]!
  const last = focusable.at(-1)!
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
onMounted(() => {
  previousFocus = document.activeElement as HTMLElement | null
  begin(props.initialAction)
  window.addEventListener('keydown', onKeydown)
  nextTick(() => document.querySelector<HTMLElement>('.detail-head > button')?.focus())
})
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown); nextTick(() => previousFocus?.focus()) })
</script>

<template>
  <div class="detail-root">
    <div class="detail-scrim" @click="requestClose" />
    <section class="detail-panel" role="dialog" aria-modal="true" :aria-label="`Details for day ${index + 1}`">
      <header class="detail-head">
        <div><span>Day {{ index + 1 }}</span><h2>{{ dowDayMon(parseISO(day.date)) }}</h2></div>
        <button type="button" aria-label="Close day details" @click="requestClose">×</button>
      </header>

      <div class="detail-scroll">
        <section class="detail-plan">
          <div><span class="group-label">Plan</span><strong>{{ [day.parkId, day.secondParkId].filter(Boolean).map((id) => parkName(id as string, store.customActivities)).join(' + ') || 'Day not set' }}</strong></div>
          <button type="button" @click="changeDay">Change day</button>
        </section>

        <div v-if="hotels.length || flights.length" class="detail-anchors">
          <p v-for="hotel in hotels" :key="hotel"><AppIcon name="bed" :size="14" /> {{ hotel }}</p>
          <p v-for="flight in flights" :key="flight.id"><AppIcon name="plane" :size="14" /> {{ flight.route || 'Flight' }}<span v-if="flight.departTime"> · {{ time12(flight.departTime) }}</span></p>
        </div>

        <div v-for="warning in warnings" :key="warning.id" class="detail-warning">
          <AppIcon name="warn" :size="16" />
          <span>{{ warning.text }}</span>
          <button type="button" @click="warning.action === 'change' ? changeDay() : openSettings()">{{ warning.action === 'change' ? 'Change plan' : 'Trip settings' }}</button>
        </div>

        <section class="detail-group">
          <div class="detail-group__head">
            <div><span class="group-label">Bookings</span><p>Date-fixed and kept on {{ day.date }} when plans move.</p></div>
            <div class="detail-group__actions"><button type="button" @click="adding = 'dining'">+ Meal</button><button type="button" @click="adding = 'fixed'">+ Booking</button></div>
          </div>
          <div class="detail-list">
            <template v-for="item in fixedItems" :key="item.id">
              <ItemForm v-if="editingId === item.id" :kind="item.kind" :item="item" :day-park-id="day.parkId" :day-second-park-id="day.secondParkId" @save="(value) => saveEdit(item.id, value)" @cancel="editingId = null" @remove="removeItem(item.id)" />
              <DayItemRow v-else :item="item" :day-park-id="day.parkId" :day-second-park-id="day.secondParkId" @edit="editingId = item.id" />
            </template>
            <p v-if="!fixedItems.length && adding !== 'fixed' && adding !== 'dining'" class="detail-empty">No date-fixed bookings.</p>
            <ItemForm v-if="adding === 'dining'" kind="dining" :day-park-id="day.parkId" :day-second-park-id="day.secondParkId" @save="saveNew" @cancel="adding = null" @remove="adding = null" />
            <ItemForm v-if="adding === 'fixed'" kind="fixed" :day-park-id="day.parkId" :day-second-park-id="day.secondParkId" @save="saveNew" @cancel="adding = null" @remove="adding = null" />
          </div>
        </section>

        <section class="detail-group">
          <div class="detail-group__head"><div><span class="group-label">Movable ideas</span><p>These travel with this day plan.</p></div><button type="button" @click="adding = 'idea'">+ Add idea</button></div>
          <div class="detail-list">
            <template v-for="item in movableItems" :key="item.id">
              <ItemForm v-if="editingId === item.id" :kind="item.kind" :item="item" :day-park-id="day.parkId" :day-second-park-id="day.secondParkId" @save="(value) => saveEdit(item.id, value)" @cancel="editingId = null" @remove="removeItem(item.id)" />
              <DayItemRow v-else :item="item" :day-park-id="day.parkId" :day-second-park-id="day.secondParkId" @edit="editingId = item.id" />
            </template>
            <p v-if="!movableItems.length && adding !== 'idea'" class="detail-empty">No movable ideas yet.</p>
            <ItemForm v-if="adding === 'idea'" kind="idea" :day-park-id="day.parkId" :day-second-park-id="day.secondParkId" @save="saveNew" @cancel="adding = null" @remove="adding = null" />
          </div>
        </section>

        <section class="detail-group">
          <div class="detail-group__head"><div><span class="group-label">Day note</span><p>Rope-drop plan, backup options, or reminders.</p></div></div>
          <textarea v-model="noteDraft" class="textarea" placeholder="Add a note for this day…" />
          <button v-if="noteDraft !== day.note" type="button" class="detail-save-note" @click="saveNote">Save note</button>
        </section>
      </div>

      <div v-if="discardPrompt" class="discard-prompt" role="alertdialog" aria-modal="true" aria-label="Discard unsaved changes?">
        <strong>Discard unsaved changes?</strong><p>The open form or note draft has not been saved.</p>
        <div><button type="button" @click="discardPrompt = false">Keep editing</button><button type="button" class="discard-prompt__discard" @click="discardAndClose">Discard</button></div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.detail-root { position:fixed; inset:0; z-index:60; height:100dvh; }
.detail-scrim { position:absolute; inset:0; background:rgb(12 16 26 / 42%); }
.detail-panel { position:absolute; inset:auto 0 0; width:100%; max-width:var(--app-max); max-height:90dvh; margin-inline:auto; display:flex; flex-direction:column; border-radius:22px 22px 0 0; background:var(--paper); box-shadow:0 -12px 40px rgb(12 16 26 / 20%); }
.detail-head { flex:none; display:flex; align-items:center; justify-content:space-between; padding:16px 18px 12px; border-bottom:1px solid var(--warm-rule); }
.detail-head span { color:var(--text-faint); font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
.detail-head h2 { margin-top:2px; font:700 20px var(--font-display); color:var(--text); }
.detail-head > button { width:34px; height:34px; border-radius:50%; background:#eef0f4; color:var(--text-muted); font-size:22px; }
.detail-scroll { flex:1; min-height:0; overflow-y:auto; padding:14px 16px max(28px, env(safe-area-inset-bottom)); }
.detail-plan { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:13px; border-radius:13px; background:var(--sand); }
.detail-plan strong { display:block; margin-top:3px; color:var(--text); font-size:14px; }
.detail-plan button,.detail-group__actions button,.detail-group__head > button { flex:none; color:var(--c-navy); font-size:11px; font-weight:800; }
.detail-anchors { display:flex; flex-direction:column; gap:7px; margin-top:12px; padding:11px 12px; border:1px solid var(--warm-border); border-radius:12px; }
.detail-anchors p { display:flex; align-items:center; gap:7px; color:var(--text-muted); font-size:12px; }
.detail-warning { display:grid; grid-template-columns:auto 1fr auto; align-items:start; gap:8px; margin-top:10px; padding:10px; border:1px solid var(--warn-border); border-radius:12px; background:var(--warn-bg); color:var(--warn-ink); }
.detail-warning span { color:var(--warn-body); font-size:11px; line-height:1.4; }
.detail-warning button { color:var(--warn-ink); font-size:10px; font-weight:800; }
.detail-group { margin-top:18px; }
.detail-group__head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:8px; }
.detail-group__head p { margin-top:2px; color:var(--text-dim); font-size:10.5px; }
.detail-group__actions { display:flex; gap:10px; }
.detail-list { display:flex; flex-direction:column; gap:8px; }
.detail-empty { padding:11px 12px; border:1px dashed var(--field-border); border-radius:var(--r-row); color:var(--text-faint); font-size:12px; }
.detail-save-note { width:100%; margin-top:8px; padding:10px; border-radius:10px; background:var(--c-navy); color:#fff; font-size:12px; font-weight:700; }
.discard-prompt { position:absolute; inset:auto 14px 14px; z-index:2; padding:15px; border-radius:14px; background:#17233a; color:#fff; box-shadow:0 12px 36px rgb(0 0 0 / 30%); }
.discard-prompt strong { font-size:14px; }.discard-prompt p { margin-top:3px; color:#dce3ef; font-size:11px; }
.discard-prompt div { display:flex; justify-content:flex-end; gap:8px; margin-top:12px; }.discard-prompt button { padding:8px 11px; border-radius:9px; background:#fff; color:var(--c-navy); font-size:11px; font-weight:700; }.discard-prompt .discard-prompt__discard { background:#ffd7cf; color:#8f2f20; }
@media (min-width:900px) { .detail-panel { inset:0 0 0 auto; width:min(520px, 46vw); max-width:none; max-height:none; border-radius:22px 0 0 22px; } }
</style>
