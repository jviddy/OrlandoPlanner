<script setup lang="ts">
const store = useTripStore()
</script>

<template>
  <div class="counters">
    <span
      v-for="c in store.counters"
      :key="c.label"
      class="counter"
      :style="{ background: c.bg, borderColor: c.border }"
    >
      <span class="counter__dot" :style="{ background: c.dot }" />
      <span class="counter__label">{{ c.label }}</span>
      <span class="counter__value" :style="{ color: c.numInk }">{{ c.value }}</span>
    </span>
  </div>
</template>

<style scoped>
.counters {
  display: flex;
  gap: 6px;
  margin-top: 11px;
  overflow-x: auto;
  scrollbar-width: none;
}
.counters::-webkit-scrollbar {
  display: none;
}
.counter {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: var(--r-pill);
  border: 1px solid transparent;
}
.counter__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.counter__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}
.counter__value {
  font-size: 12px;
  font-weight: 700;
}
</style>
