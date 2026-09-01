<script setup lang="ts">
import { RESORTS, PARK_BY_ID, parkName } from '~/data/parks'
import { parseISO, useDates } from '~/composables/useDates'
import type { DayItem, ItemKind } from '~/types/trip'

definePageMeta({ pageTransition: { name: 'slide', mode: 'default' } })
useHead({ title: 'Day · Orlando Planner' })

const store = useTripStore()
const { dowDayMon } = useDates()

onMounted(() => {
  if (!store.hasTrip) return navigateTo('/', { replace: true })
  if (store.selectedDay === null) navigateTo('/', { replace: true })
})

const index = computed(() => store.selectedDay ?? 0)
const day = computed(() => store.selected)
const park = computed(() => (day.value?.parkId ? PARK_BY_ID[day.value.parkId] ?? null : null))
const resort = computed(() => (park.value ? RESORTS[park.value.resort] : null))
const isLight = computed(() => !day.value?.parkId)

const headInk = computed(() => {
  if (isLight.value || !resort.value) return 'var(--text)'
  return resort.value.fg === '#ffffff' ? '#ffffff' : '#7a5600'
})
const headSub = computed(() => {
  if (isLight.value || !resort.value) return 'var(--text-faint)'
  return resort.value.fg === '#ffffff'
    ? 'rgba(255,255,255,.8)'
    : 'rgba(122,86,0,.7)'
})
const headBg = computed(() =>
  isLight.value || !resort.value ? 'var(--paper)' : resort.value.bg,
)

const dateLine = computed(() => {
  if (!day.value) return ''
  return `Day ${index.value + 1} of ${store.days.length} · ${dowDayMon(parseISO(day.value.date))}`
})

const warnings = computed(() =>
  (day.value?.items ?? [])
    .filter((it) => it.parkId && it.parkId !== day.value!.parkId)
    .map(
      (it) =>
        `${it.title} at ${parkName(it.parkId)} — but this day is set to ${
          day.value!.parkId ? parkName(day.value!.parkId) : 'nothing'
        }.`,
    ),
)

const groups: { key: ItemKind; title: string; hint: string; add: string }[] = [
  {
    key: 'dining',
    title: 'Eating',
    hint: 'Bookings open 60 days out',
    add: 'Add a meal or an idea',
  },
  {
    key: 'fixed',
    title: 'Fixed times',
    hint: "Won't move if you shuffle days",
    add: 'Add Lightning Lane, tour or show',
  },
]

function itemsOf(kind: ItemKind): DayItem[] {
  return (day.value?.items ?? []).filter((i) => i.kind === kind)
}

const adding = reactive<Record<ItemKind, boolean>>({ dining: false, fixed: false })
const editingId = ref<string | null>(null)

function startAdd(kind: ItemKind) {
  editingId.value = null
  adding[kind] = true
}
function saveNew(kind: ItemKind, value: Omit<DayItem, 'id'>) {
  store.addItem(index.value, value)
  adding[kind] = false
}
function saveEdit(id: string, value: Omit<DayItem, 'id'>) {
  store.updateItem(index.value, id, value)
  editingId.value = null
}
function removeItem(id: string) {
  store.removeItem(index.value, id)
  editingId.value = null
}
</script>

<template>
  <div class="screen dayview">
    <ClientOnly>
      <template v-if="day">
        <header class="dv-head" :style="{ background: headBg, color: headInk }">
          <div class="dv-head__nav">
            <button type="button" class="dv-head__link" @click="navigateTo('/')">
              <AppIcon name="arrowLeft" :size="15" /> Overview
            </button>
            <div class="dv-head__steps">
              <button
                type="button"
                class="dv-head__link dv-head__link--dim"
                :disabled="index === 0"
                @click="store.stepDay(-1)"
              >
                Prev
              </button>
              <button
                type="button"
                class="dv-head__link dv-head__link--dim"
                :disabled="index === store.days.length - 1"
                @click="store.stepDay(1)"
              >
                Next
              </button>
            </div>
          </div>
          <div class="dv-head__id">
            <button
              type="button"
              class="dv-head__circle"
              aria-label="Change this day"
              @click="store.openSheet(index)"
            >
              <DayCircle :park-id="day.parkId" :size="56" inverted bob />
            </button>
            <div class="dv-head__names">
              <p class="dv-head__park">{{ parkName(day.parkId) }}</p>
              <p class="dv-head__date" :style="{ color: headSub }">{{ dateLine }}</p>
            </div>
          </div>
        </header>

        <div class="scroll dv-body">
          <div v-for="w in warnings" :key="w" class="dv-warn">
            <AppIcon name="warn" :size="16" :stroke="2.2" />
            <span>{{ w }}</span>
          </div>

          <section v-for="g in groups" :key="g.key" class="dgroup">
            <div class="dgroup__head">
              <span class="group-label">{{ g.title }}</span>
              <span class="dgroup__hint">{{ g.hint }}</span>
            </div>
            <div class="dgroup__items">
              <template v-for="it in itemsOf(g.key)" :key="it.id">
                <ItemForm
                  v-if="editingId === it.id"
                  :kind="g.key"
                  :item="it"
                  :day-park-id="day.parkId"
                  @save="(v) => saveEdit(it.id, v)"
                  @cancel="editingId = null"
                  @remove="removeItem(it.id)"
                />
                <DayItemRow
                  v-else
                  :item="it"
                  :day-park-id="day.parkId"
                  @edit="editingId = it.id"
                />
              </template>

              <ItemForm
                v-if="adding[g.key]"
                :kind="g.key"
                :day-park-id="day.parkId"
                @save="(v) => saveNew(g.key, v)"
                @cancel="adding[g.key] = false"
                @remove="adding[g.key] = false"
              />
              <button
                v-else
                type="button"
                class="dgroup__add"
                @click="startAdd(g.key)"
              >
                <AppIcon name="plus" :size="15" :stroke="2.2" />
                {{ g.add }}
              </button>
            </div>
          </section>

          <div class="dgroup">
            <span class="group-label">Note</span>
            <textarea
              class="textarea"
              :value="day.note"
              placeholder="Rope drop plan, backup park, who's tired…"
              @input="store.setDayNote(index, ($event.target as HTMLTextAreaElement).value)"
            />
          </div>
        </div>
      </template>

      <div v-else class="dv-loading" />

      <template #fallback>
        <div class="dv-loading" />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.dayview {
  background: var(--sand);
}
.dv-loading {
  flex: 1;
  background: var(--sand);
}

.dv-head {
  flex: none;
  padding: 12px 18px 16px;
  transition: background 0.2s ease;
}
.dv-head__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dv-head__steps {
  display: flex;
  gap: 14px;
}
.dv-head__link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13.5px;
  font-weight: 600;
  color: inherit;
}
.dv-head__link--dim {
  opacity: 0.75;
}
.dv-head__link:disabled {
  opacity: 0.4;
}
.dv-head__id {
  display: flex;
  align-items: center;
  gap: 13px;
  margin-top: 14px;
}
.dv-head__circle {
  border-radius: 50%;
}
.dv-head__circle:active {
  transform: scale(0.94);
}
.dv-head__names {
  min-width: 0;
}
.dv-head__park {
  font: 700 22px/1.1 var(--font-display);
  letter-spacing: -0.02em;
  color: inherit;
}
.dv-head__date {
  font-size: 13px;
  margin-top: 3px;
}

.dv-body {
  padding: 14px 16px 30px;
}
.dv-warn {
  display: flex;
  gap: 9px;
  padding: 11px 12px;
  border-radius: 13px;
  background: var(--warn-bg);
  border: 1px solid var(--warn-border);
  color: var(--warn-ink);
  margin-bottom: 12px;
}
.dv-warn span {
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--warn-body);
}
.dv-warn :deep(svg) {
  flex: none;
  margin-top: 1px;
}

.dgroup {
  margin-bottom: 16px;
}
.dgroup__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}
.dgroup__hint {
  font-size: 11.5px;
  color: var(--text-dim);
}
.dgroup__items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dgroup__add {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 13px;
  border: 1.5px dashed var(--field-border);
  border-radius: var(--r-row);
  color: var(--text-muted);
  font-size: 13.5px;
  font-weight: 600;
  transition: transform 0.06s ease;
}
.dgroup__add:active {
  transform: scale(0.99);
}
.dgroup .textarea {
  margin-top: 0;
}
</style>
