<script setup lang="ts">
import { PARK_BY_ID } from '~/data/parks'
import { TEMPLATES, templateParkId } from '~/data/templates'

useHead({ title: 'Pick a starting point · Orlando Planner' })

const store = useTripStore()
const route = useRoute()
const selectedId = ref<string | null>(null)
const strategy = ref<'fill-unset' | 'replace-movable'>('fill-unset')
const selectedTemplate = computed(() => TEMPLATES.find((t) => t.id === selectedId.value))

onMounted(() => {
  if (store.hasTrip && route.query.reapply !== '1') return navigateTo('/', { replace: true })
  if (!store.datesValid) navigateTo('/new', { replace: true })
})

const headline = computed(() => `${store.dayCount} days to fill.`)

/** Up to 11 preview circles that mirror what the template will lay down. */
function preview(pattern: string[] | null, limit = 11) {
  const n = store.dayCount || 10
  const out: (string | null)[] = []
  for (let i = 0; i < Math.min(limit, n); i++) {
    out.push(templateParkId(pattern, i, n))
  }
  return out
}

function pick(id: string) {
  selectedId.value = id
  strategy.value = 'fill-unset'
}

const conflicts = computed(() => {
  if (!selectedTemplate.value) return { assigned: 0, fixed: 0, unset: 0 }
  return {
    assigned: store.days.filter((day) => day.parkId || day.secondParkId).length,
    fixed: store.days.reduce((sum, day) => sum + day.items.filter((item) => item.anchor === 'date').length, 0),
    unset: store.days.filter((day) => !day.parkId && !day.secondParkId).length,
  }
})

function applySelected() {
  if (!selectedId.value) return
  store.applyTemplate(selectedId.value, strategy.value)
  navigateTo(route.query.return === 'plan' ? '/plan' : '/')
}
</script>

<template>
  <div class="screen">
    <ClientOnly>
      <div class="scroll fade-in">
        <header class="tp__head">
          <NuxtLink to="/new" class="linkback">
            <AppIcon name="arrowLeft" :size="15" /> Trip details
          </NuxtLink>
          <h1>{{ headline }}</h1>
          <p class="tp__lede">
            Start empty, or drop in a shape you can pull apart.
          </p>
        </header>

        <div class="tp__cards">
          <button
            v-for="t in TEMPLATES"
            :key="t.id"
            type="button"
            class="tcard"
            @click="pick(t.id)"
          >
            <div class="tcard__row">
              <span class="tcard__name">{{ t.name }}</span>
              <span class="tcard__meta">{{ t.meta }}</span>
            </div>
            <p class="tcard__blurb">{{ t.blurb }}</p>
            <div class="tcard__preview">
              <DayCircle
                v-for="(pid, i) in preview(t.pattern)"
                :key="i"
                :park-id="pid"
                :size="20"
                :stroke-width="2.4"
                flat
              />
            </div>
          </button>
        </div>
      </div>

      <div v-if="selectedTemplate" class="tp__veil" @click.self="selectedId = null">
        <section class="tp__dialog" role="dialog" aria-modal="true" aria-labelledby="template-preview-title">
          <button class="tp__close" type="button" aria-label="Close preview" @click="selectedId = null">×</button>
          <p class="eyebrow">Starting shape preview</p>
          <h2 id="template-preview-title">{{ selectedTemplate.name }}</h2>
          <p>{{ selectedTemplate.blurb }}</p>
          <div class="tp__full-preview" aria-label="Proposed day pattern">
            <DayCircle
              v-for="(pid, i) in preview(selectedTemplate.pattern, store.dayCount)"
              :key="i"
              :park-id="pid"
              :size="26"
              :stroke-width="2.5"
              flat
            />
          </div>

          <fieldset v-if="store.created" class="tp__scope">
            <legend>How should this shape be applied?</legend>
            <label>
              <input v-model="strategy" type="radio" value="fill-unset" />
              <span><strong>Fill unset days</strong><small>Keeps all {{ conflicts.assigned }} day plans already set.</small></span>
            </label>
            <label>
              <input v-model="strategy" type="radio" value="replace-movable" />
              <span><strong>Replace movable plans</strong><small>Replaces parks, notes and ideas. Fixed bookings stay.</small></span>
            </label>
          </fieldset>
          <p v-if="store.created" class="tp__conflict">
            {{ conflicts.unset }} unset days · {{ conflicts.fixed }} fixed booking{{ conflicts.fixed === 1 ? '' : 's' }} protected
          </p>
          <button class="cta" type="button" @click="applySelected">
            {{ store.created ? 'Apply starting shape' : 'Use this starting shape' }}
          </button>
        </section>
      </div>

      <template #fallback>
        <div class="scroll" style="background: var(--paper)" />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.2s ease;
}
.tp__head {
  padding: 18px 20px 4px;
}
.tp__head .linkback {
  margin-bottom: 14px;
}
.tp__head h1 {
  font-size: 27px;
  line-height: 1.15;
  margin: 0 0 6px;
}
.tp__lede {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-muted);
}
.tp__cards {
  padding: 18px 20px 30px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
@media (min-width: 700px) {
  .tp__cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
.tcard {
  text-align: left;
  border: 1.5px solid var(--warm-border);
  border-radius: var(--r-card);
  background: #fff;
  padding: 16px;
  box-shadow: var(--sh-template);
  transition: transform 0.06s ease;
}
.tcard:active {
  transform: scale(0.99);
}
.tcard__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.tcard__name {
  font: 700 17px var(--font-display);
  color: var(--text);
}
.tcard__meta {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-faint);
}
.tcard__blurb {
  font-size: 13.5px;
  line-height: 1.45;
  color: var(--text-muted);
  margin-top: 5px;
}
.tcard__preview {
  display: flex;
  gap: 4px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.tp__veil {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(9, 26, 51, 0.44);
}
.tp__dialog {
  position: relative;
  width: min(480px, 100%);
  max-height: calc(100dvh - 36px);
  overflow: auto;
  padding: 22px;
  border-radius: var(--r-card);
  background: var(--paper);
  box-shadow: 0 20px 55px rgba(9, 26, 51, 0.25);
}
.tp__dialog h2 { margin: 4px 0 7px; font-size: 23px; }
.tp__dialog > p:not(.eyebrow):not(.tp__conflict) { color: var(--text-muted); line-height: 1.45; }
.tp__close { position: absolute; right: 15px; top: 10px; font-size: 28px; color: var(--text-muted); }
.tp__full-preview { display: flex; flex-wrap: wrap; gap: 6px; margin: 17px 0; }
.tp__scope { border: 0; padding: 0; margin: 10px 0; }
.tp__scope legend { font-weight: 700; font-size: 14px; margin-bottom: 8px; }
.tp__scope label { display: flex; gap: 10px; padding: 10px; border: 1px solid var(--warm-border); border-radius: var(--r-row); margin-top: 7px; }
.tp__scope span, .tp__scope small { display: block; }
.tp__scope small { margin-top: 2px; color: var(--text-faint); }
.tp__conflict { font-size: 12.5px; color: var(--text-faint); margin: 12px 0; }
.tp__dialog .cta { width: 100%; margin-top: 6px; }
</style>
