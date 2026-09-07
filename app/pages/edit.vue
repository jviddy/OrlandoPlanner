<script setup lang="ts">
import type { WeekStart } from '~/types/trip'

useHead({ title: 'Edit trip · Orlando Planner' })

const store = useTripStore()

onMounted(() => {
  if (!store.hasTrip) navigateTo('/new', { replace: true })
})

const weekStartOptions: { value: WeekStart; label: string }[] = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'tripDay1', label: 'Day 1 of my trip' },
]

const confirmReset = ref(false)
function reset() {
  store.resetTrip()
  navigateTo('/new', { replace: true })
}
</script>

<template>
  <div class="screen">
    <ClientOnly>
      <div class="scroll">
        <header class="edit__head">
          <NuxtLink to="/" class="linkback">
            <AppIcon name="arrowLeft" :size="15" /> Overview
          </NuxtLink>
          <h1>Edit trip</h1>
          <p class="edit__lede">
            Changing the dates keeps every day you've already set — days are
            matched by date.
          </p>
        </header>

        <TripDetailsFields />

        <div class="edit__section">
          <p class="group-label">Week starts on</p>
          <div class="segmented">
            <button
              v-for="opt in weekStartOptions"
              :key="opt.value"
              type="button"
              class="segmented__btn"
              :class="{ 'segmented__btn--on': store.weekStart === opt.value }"
              @click="store.updateFields({ weekStart: opt.value })"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="edit__danger">
          <hr />
          <template v-if="!confirmReset">
            <button type="button" class="edit__reset" @click="confirmReset = true">
              Start a fresh trip
            </button>
            <p class="edit__note">Clears this trip and its day grid.</p>
          </template>
          <div v-else class="edit__confirm">
            <span>Delete this trip and start over?</span>
            <div class="edit__confirm-row">
              <button type="button" class="edit__btn" @click="confirmReset = false">
                Keep it
              </button>
              <button type="button" class="edit__btn edit__btn--del" @click="reset">
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="edit__foot">
        <button class="cta" @click="navigateTo('/')">Done</button>
      </div>

      <template #fallback>
        <div class="scroll" style="background: var(--paper)" />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.edit__head {
  padding: 18px 20px 4px;
}
.edit__head .linkback {
  margin-bottom: 14px;
}
.edit__head h1 {
  font-size: 27px;
  margin: 0 0 6px;
}
.edit__lede {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-muted);
}
.edit__section {
  padding: 4px 20px 20px;
}
.segmented {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}
.segmented__btn {
  flex: 1;
  padding: 10px 6px;
  border-radius: var(--r-sheet-tile);
  background: #f2f4f9;
  color: var(--text-muted);
  font-size: 12.5px;
  font-weight: 600;
  text-align: center;
  border: 1.5px solid transparent;
}
.segmented__btn--on {
  background: var(--tile-selected);
  color: var(--c-navy);
  border-color: var(--c-navy);
}
.edit__danger {
  padding: 4px 20px 28px;
}
.edit__danger hr {
  border: 0;
  border-top: 1px solid var(--warm-border);
  margin-bottom: 16px;
}
.edit__reset {
  font-size: 14px;
  font-weight: 700;
  color: var(--warn-ink);
}
.edit__note {
  font-size: 12.5px;
  color: var(--text-faint);
  margin-top: 3px;
}
.edit__confirm span {
  font-size: 14px;
  font-weight: 600;
}
.edit__confirm-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.edit__btn {
  padding: 9px 16px;
  border-radius: var(--r-sheet-tile);
  font-size: 13px;
  font-weight: 600;
  background: #f2f4f9;
  color: var(--text-muted);
}
.edit__btn--del {
  background: var(--warn-ink);
  color: #fff;
}
.edit__foot {
  flex: none;
  padding: 12px 20px max(26px, env(safe-area-inset-bottom));
  background: var(--paper);
  border-top: 1px solid var(--warm-rule);
}
</style>
