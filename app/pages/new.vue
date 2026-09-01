<script setup lang="ts">
useHead({ title: 'New trip · Orlando Planner' })

const store = useTripStore()

onMounted(() => {
  if (store.hasTrip) navigateTo('/', { replace: true })
})

function next() {
  if (store.datesValid) navigateTo('/templates')
}
</script>

<template>
  <div class="screen">
    <ClientOnly>
      <div class="scroll">
        <header class="gate__head">
          <p class="eyebrow">New trip</p>
          <h1>Let's get the bones in.</h1>
          <p class="gate__lede">
            Name and dates are all we need. The rest sharpens the warnings later.
          </p>
        </header>

        <TripDetailsFields />
      </div>

      <div class="gate__foot">
        <button class="cta" :disabled="!store.datesValid" @click="next">
          Next — pick a starting point
        </button>
      </div>

      <template #fallback>
        <div class="scroll" style="background: var(--paper)" />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.gate__head {
  padding: 20px 20px 8px;
}
.gate__head h1 {
  font-size: 30px;
  line-height: 1.1;
  margin: 8px 0 6px;
}
.gate__lede {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-muted);
}
.gate__foot {
  flex: none;
  padding: 12px 20px max(26px, env(safe-area-inset-bottom));
  background: var(--paper);
  border-top: 1px solid var(--warm-rule);
}
</style>
