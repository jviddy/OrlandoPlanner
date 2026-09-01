<script setup lang="ts">
useHead({ title: 'Orlando Trip Planner' })

const store = useTripStore()

onMounted(() => {
  if (!store.hasTrip) navigateTo('/new', { replace: true })
})

function fixAlert(dayIndex: number | undefined) {
  if (dayIndex === undefined) return
  store.selectDay(dayIndex)
  navigateTo('/day')
}
</script>

<template>
  <div class="screen overview">
    <ClientOnly>
      <template v-if="store.hasTrip">
        <header class="ov-head">
          <div class="ov-head__row">
            <NuxtLink to="/edit" class="ov-head__trip">
              <span class="ov-head__name">{{ store.name }}</span>
              <span class="ov-head__range">
                {{ store.rangeLabel }}
                <AppIcon name="pencil" :size="11" class="ov-head__pencil" />
              </span>
            </NuxtLink>
            <span class="countdown">
              <span class="countdown__num">{{ store.sleepsToGo }}</span>
              <span class="countdown__label">Sleeps to go</span>
            </span>
          </div>
          <CounterRow />
        </header>

        <div class="scroll ov-body">
          <AlertCard
            v-for="a in store.alerts"
            :key="a.id"
            :tone="a.tone"
            :title="a.title"
            :body="a.body"
            :action-label="a.fixDayIndex !== undefined ? 'Fix' : undefined"
            class="ov-alert"
            @action="fixAlert(a.fixDayIndex)"
          />

          <WeekGrid />

          <div class="hint">
            <AppIcon name="info" :size="15" />
            <span>Tap a circle to set the day. Press and hold to open it.</span>
          </div>
        </div>
      </template>

      <div v-else class="ov-loading" />

      <template #fallback>
        <div class="ov-loading" />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.overview {
  background: var(--sand);
}
.ov-loading {
  flex: 1;
  background: var(--sand);
}

.ov-head {
  flex: none;
  background: var(--paper);
  padding: 10px 18px 12px;
  border-bottom: 1px solid var(--warm-rule);
}
.ov-head__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.ov-head__trip {
  min-width: 0;
  display: block;
  color: inherit;
}
.ov-head__name {
  display: block;
  font: 700 21px/1.15 var(--font-display);
  letter-spacing: -0.02em;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ov-head__range {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--text-faint);
  margin-top: 2px;
}
.ov-head__pencil {
  opacity: 0.7;
}

.countdown {
  flex: none;
  text-align: center;
  background: var(--chip-bg);
  border-radius: var(--r-alert);
  padding: 7px 12px;
  box-shadow: var(--chip-shadow);
}
.countdown__num {
  display: block;
  font: 800 19px/1 var(--font-display);
  letter-spacing: -0.02em;
  color: var(--chip-num);
}
.countdown__label {
  display: block;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--chip-label);
  margin-top: 3px;
}

.ov-body {
  padding: 12px 12px 96px;
}
.ov-alert {
  margin-bottom: 9px;
}
.ov-alert + .weeks {
  margin-top: 3px;
}

.hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--r-input);
  background: var(--hint-strip);
  color: var(--text-muted);
  margin-top: 14px;
}
.hint span {
  font-size: 12px;
  line-height: 1.4;
}
.hint :deep(svg) {
  flex: none;
  color: var(--text-faint);
}
</style>
