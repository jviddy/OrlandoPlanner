<script setup lang="ts">
useHead({ title: 'Packing · Orlando Trip Planner' })

const store = useTripStore()

const newLabel = ref('')
const newCategory = ref('Park bag')

const categoryOrder = [
  'Park bag',
  'Clothing',
  'Documents & money',
  'Health',
  'Tech',
  'Kids',
  'Other',
]

const groups = computed(() => {
  const map = store.packingByCategory
  const known = categoryOrder.filter((c) => map[c]?.length)
  const extra = Object.keys(map)
    .filter((c) => !categoryOrder.includes(c))
    .sort()
  return [...known, ...extra].map((c) => ({ category: c, items: map[c] ?? [] }))
})

function add() {
  const label = newLabel.value.trim()
  if (!label) return
  store.addPackingItem(label, newCategory.value)
  newLabel.value = ''
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Packing list</h1>
        <p>
          Tuned for Orlando: heat, humidity, big step counts and a downpour most
          afternoons.
        </p>
      </div>
    </div>

    <ClientOnly>
      <section class="card card-pad head">
        <ProgressMeter
          :value="store.packingProgress.done"
          :max="store.packingProgress.total || 1"
          :label="`${store.packingProgress.done} of ${store.packingProgress.total} packed`"
          accent="var(--c-sun)"
        />
        <div class="head__actions">
          <button
            v-if="!store.packing.length"
            type="button"
            class="btn btn-primary btn-sm"
            @click="store.seedPacking(true)"
          >
            <AppIcon name="sparkles" :size="14" /> Load starter list
          </button>
          <button
            v-else
            type="button"
            class="btn btn-sm"
            @click="store.seedPacking(true)"
          >
            <AppIcon name="plus" :size="14" /> Add missing starter items
          </button>
          <button
            v-if="store.packingProgress.done"
            type="button"
            class="btn btn-sm btn-ghost"
            @click="store.clearCheckedPacking()"
          >
            Remove checked
          </button>
        </div>
      </section>

      <form class="additem card card-pad" @submit.prevent="add">
        <input
          v-model="newLabel"
          class="input"
          placeholder="Add an item — e.g. Pop Century luggage tags"
          aria-label="New packing item"
        />
        <select v-model="newCategory" class="select" aria-label="Category">
          <option v-for="c in categoryOrder" :key="c" :value="c">{{ c }}</option>
        </select>
        <button type="submit" class="btn btn-primary" :disabled="!newLabel.trim()">
          <AppIcon name="plus" :size="15" /> Add
        </button>
      </form>

      <div v-if="groups.length" class="groups">
        <section v-for="g in groups" :key="g.category" class="card card-pad group">
          <div class="section-title group__title">
            <h3>{{ g.category }}</h3>
            <span class="chip">
              {{ g.items.filter((i) => i.done).length }}/{{ g.items.length }}
            </span>
          </div>
          <ul role="list" class="checklist">
            <li
              v-for="item in g.items"
              :key="item.id"
              class="checkrow"
              :class="{ 'checkrow--done': item.done }"
            >
              <label class="checkrow__label">
                <input
                  type="checkbox"
                  :checked="item.done"
                  @change="store.togglePacking(item.id)"
                />
                <span>{{ item.label }}</span>
              </label>
              <button
                type="button"
                class="btn btn-icon btn-ghost btn-sm checkrow__del"
                title="Remove"
                @click="store.removePackingItem(item.id)"
              >
                <AppIcon name="x" :size="14" />
              </button>
            </li>
          </ul>
        </section>
      </div>
      <EmptyState
        v-else
        icon="bag"
        title="Your list is empty"
        message="Load the Orlando starter list and tweak it from there."
      >
        <button
          type="button"
          class="btn btn-primary btn-sm"
          @click="store.seedPacking(true)"
        >
          Load starter list
        </button>
      </EmptyState>

      <template #fallback>
        <div class="card sk" />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.head :deep(.meter) {
  flex: 1;
  min-width: 220px;
}
.head__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.additem {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 8px;
  margin-bottom: 18px;
}
@media (max-width: 620px) {
  .additem {
    grid-template-columns: 1fr 1fr;
  }
  .additem .input {
    grid-column: 1 / -1;
  }
}
.groups {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  align-items: start;
}
.group__title {
  justify-content: space-between;
  margin-bottom: 8px;
}
.checklist {
  display: grid;
  gap: 2px;
}
.checkrow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-top: 1px solid var(--border);
}
.checkrow:first-child {
  border-top: 0;
}
.checkrow__label {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  cursor: pointer;
  font-size: 0.92rem;
}
.checkrow__label input {
  width: 18px;
  height: 18px;
  flex: none;
}
.checkrow--done .checkrow__label span {
  text-decoration: line-through;
  color: var(--text-faint);
}
.checkrow__del {
  opacity: 0.5;
}
.checkrow__del:hover {
  opacity: 1;
  color: var(--danger);
}
.sk {
  min-height: 320px;
}
</style>
