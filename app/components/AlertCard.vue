<script setup lang="ts">
const props = defineProps<{
  tone: 'warn' | 'remind'
  title?: string
  body: string
  actionLabel?: string
}>()

const emit = defineEmits<{ action: [] }>()

const skin = computed(() =>
  props.tone === 'remind'
    ? { bg: 'var(--remind-bg)', bd: 'var(--remind-border)', ink: 'var(--remind-ink)', icon: 'bell' as const }
    : { bg: 'var(--warn-bg)', bd: 'var(--warn-border)', ink: 'var(--warn-ink)', icon: 'warn' as const },
)
</script>

<template>
  <div class="alert" :style="{ background: skin.bg, borderColor: skin.bd }">
    <AppIcon :name="skin.icon" :size="16" :stroke="2.2" :style="{ color: skin.ink }" class="alert__icon" />
    <div class="alert__text">
      <p v-if="title" class="alert__title">{{ title }}</p>
      <p class="alert__body">{{ body }}</p>
    </div>
    <button
      v-if="actionLabel"
      type="button"
      class="alert__action"
      :style="{ color: skin.ink }"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>

<style scoped>
.alert {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  padding: 11px 12px;
  border-radius: 13px;
  border: 1px solid transparent;
}
.alert__icon {
  flex: none;
  margin-top: 1px;
}
.alert__text {
  flex: 1;
  min-width: 0;
}
.alert__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.35;
}
.alert__body {
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.4;
  margin-top: 1px;
}
.alert__action {
  flex: none;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 0;
  align-self: flex-start;
}
</style>
