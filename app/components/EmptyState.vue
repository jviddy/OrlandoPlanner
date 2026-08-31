<script setup lang="ts">
defineProps<{ icon?: string; title: string; message?: string }>()
</script>

<template>
  <div class="empty card card-pad">
    <div class="empty__icon">
      <AppIcon :name="icon ?? 'sparkles'" :size="26" />
    </div>
    <h3>{{ title }}</h3>
    <p v-if="message" class="muted">{{ message }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty {
  text-align: center;
  display: grid;
  justify-items: center;
  gap: 8px;
  border-style: dashed;
  background: transparent;
}
.empty__icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--bg-sunk);
  color: var(--accent);
  margin-bottom: 4px;
}
.empty p {
  max-width: 46ch;
}
.empty :slotted(*) {
  margin-top: 8px;
}
</style>
