<script setup lang="ts">
import { PARK_BY_ID } from '~/data/parks'
import { TEMPLATES, templateParkId } from '~/data/templates'

useHead({ title: 'Pick a starting point · Orlando Planner' })

const store = useTripStore()

onMounted(() => {
  if (store.hasTrip) return navigateTo('/', { replace: true })
  if (!store.datesValid) navigateTo('/new', { replace: true })
})

const headline = computed(() => `${store.dayCount} days to fill.`)

/** Up to 11 preview circles that mirror what the template will lay down. */
function preview(pattern: string[] | null) {
  const n = store.dayCount || 10
  const out: (string | null)[] = []
  for (let i = 0; i < Math.min(11, n); i++) {
    out.push(templateParkId(pattern, i, n))
  }
  return out
}

function pick(id: string) {
  store.applyTemplate(id)
  navigateTo('/')
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
</style>
