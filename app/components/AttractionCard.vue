<script setup lang="ts">
import {
  INTENSITY_LABEL,
  TYPE_LABEL,
  type Attraction,
} from '~/data/attractions'
import { PARK_BY_ID } from '~/data/parks'

const props = defineProps<{
  attraction: Attraction
  plannedDay?: number | null
  dayOptions: { index: number; label: string }[]
}>()

const emit = defineEmits<{
  add: [dayIndex: number]
  remove: [dayIndex: number]
}>()

const { duration } = useFormat()
const park = computed(() => PARK_BY_ID[props.attraction.parkId] ?? null)

const target = ref(props.dayOptions[0]?.index ?? 0)
watch(
  () => props.dayOptions,
  (opts) => {
    if (!opts.some((o) => o.index === target.value)) {
      target.value = opts[0]?.index ?? 0
    }
  },
)

const isPlanned = computed(
  () => props.plannedDay !== null && props.plannedDay !== undefined,
)
</script>

<template>
  <article class="acard card" :class="{ 'acard--planned': isPlanned }">
    <div class="acard__bar" :style="{ background: park?.color ?? 'var(--accent)' }" />
    <div class="acard__body">
      <header class="acard__head">
        <div>
          <h3 class="acard__name">{{ attraction.name }}</h3>
          <p class="acard__where muted">
            <AppIcon name="pin" :size="13" />
            {{ park?.name }} · {{ attraction.land }}
          </p>
        </div>
        <span
          v-if="attraction.priority === 1"
          class="chip acard__must"
          title="Top-priority headliner"
        >
          <AppIcon name="bolt" :size="12" /> Must-do
        </span>
      </header>

      <p class="acard__note">{{ attraction.note }}</p>

      <div class="tag-row acard__meta">
        <span class="chip">{{ TYPE_LABEL[attraction.type] }}</span>
        <span class="chip" :data-intensity="attraction.intensity">
          {{ INTENSITY_LABEL[attraction.intensity] }}
        </span>
        <span class="chip">
          <AppIcon name="clock" :size="12" /> {{ duration(attraction.durationMin) }}
        </span>
        <span v-if="attraction.minHeightIn" class="chip">
          ↕ {{ attraction.minHeightIn }}″ min
        </span>
      </div>

      <footer class="acard__foot">
        <p v-if="isPlanned" class="acard__planned-label">
          <AppIcon name="check" :size="14" />
          On
          {{
            dayOptions.find((o) => o.index === plannedDay)?.label ??
            `Day ${(plannedDay ?? 0) + 1}`
          }}
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            @click="emit('remove', plannedDay as number)"
          >
            Remove
          </button>
        </p>
        <div v-else class="acard__add">
          <label class="sr-only" :for="`day-${attraction.id}`">Add to day</label>
          <select
            :id="`day-${attraction.id}`"
            v-model.number="target"
            class="select select-sm"
          >
            <option v-for="o in dayOptions" :key="o.index" :value="o.index">
              {{ o.label }}
            </option>
          </select>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            @click="emit('add', target)"
          >
            <AppIcon name="plus" :size="14" /> Add
          </button>
        </div>
      </footer>
    </div>
  </article>
</template>

<style scoped>
.acard {
  display: flex;
  overflow: hidden;
}
.acard__bar {
  width: 5px;
  flex: none;
}
.acard__body {
  padding: 16px;
  display: grid;
  gap: 10px;
  align-content: start;
  flex: 1;
}
.acard__head {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  align-items: start;
}
.acard__name {
  font-size: 1.02rem;
}
.acard__where {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
  margin-top: 2px;
}
.acard__must {
  color: var(--c-coral);
  border-color: color-mix(in srgb, var(--c-coral) 40%, var(--border));
  flex: none;
}
.acard__note {
  font-size: 0.9rem;
  color: var(--text-muted);
}
.acard__meta {
  margin-top: 2px;
}
.acard__foot {
  margin-top: 4px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
}
.acard__add {
  display: flex;
  gap: 8px;
}
.select-sm {
  padding: 6px 8px;
  font-size: 0.85rem;
  border-radius: var(--radius-sm);
  flex: 1;
  min-width: 0;
}
.btn-sm {
  flex: none;
}
.acard__planned-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--success);
}
.acard__planned-label .btn {
  margin-left: auto;
  color: var(--text-muted);
  font-weight: 600;
}
.acard--planned {
  border-color: color-mix(in srgb, var(--success) 35%, var(--border));
}
</style>
