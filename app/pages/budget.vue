<script setup lang="ts">
import { BUDGET_CATEGORIES, type BudgetCategory } from '~/types/trip'

useHead({ title: 'Budget · Orlando Trip Planner' })

const store = useTripStore()
const { money } = useFormat()

const draft = reactive({
  label: '',
  category: 'Tickets' as BudgetCategory,
  amount: '' as number | string,
  day: '' as number | string,
  paid: false,
})

function addItem() {
  const amount = Number(draft.amount)
  if (!draft.label.trim() || !Number.isFinite(amount) || amount <= 0) return
  store.addBudgetItem({
    label: draft.label.trim(),
    category: draft.category,
    amount: Math.round(amount),
    day: draft.day === '' ? null : Number(draft.day),
    paid: draft.paid,
  })
  draft.label = ''
  draft.amount = ''
  draft.day = ''
  draft.paid = false
}

const categoryRows = computed(() =>
  BUDGET_CATEGORIES.map((c) => ({
    category: c,
    amount: store.budgetByCategory[c] ?? 0,
  })).filter((r) => r.amount > 0),
)

const maxCategory = computed(() =>
  Math.max(1, ...categoryRows.value.map((r) => r.amount)),
)

const overBudget = computed(() => store.budgetRemaining < 0)
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Budget</h1>
        <p>Track what the trip will cost and how much you've already paid.</p>
      </div>
    </div>

    <ClientOnly>
      <section class="grid summary">
        <div class="card card-pad total-card">
          <label class="field">
            <span>Total budget</span>
            <div class="total-input">
              <span class="total-input__sign">$</span>
              <input
                class="input"
                type="number"
                min="0"
                step="100"
                :value="store.budgetTotal"
                @change="
                  store.setBudgetTotal(
                    Number(($event.target as HTMLInputElement).value),
                  )
                "
              />
            </div>
          </label>
          <ProgressMeter
            class="total-card__meter"
            :value="store.budgetSpent"
            :max="store.budgetTotal"
            :label="`${money(store.budgetSpent)} allocated`"
            :accent="overBudget ? 'var(--danger)' : 'var(--c-coral)'"
          />
        </div>

        <StatCard
          label="Allocated"
          :value="money(store.budgetSpent)"
          :hint="`${store.budget.length} line items`"
          icon="list"
          accent="var(--c-navy)"
        />
        <StatCard
          label="Remaining"
          :value="money(store.budgetRemaining)"
          :hint="overBudget ? 'over budget' : 'still unallocated'"
          icon="wallet"
          :accent="overBudget ? 'var(--danger)' : 'var(--success)'"
        />
        <StatCard
          label="Paid so far"
          :value="money(store.budgetPaid)"
          :hint="`${money(store.budgetSpent - store.budgetPaid)} still owed`"
          icon="check"
          accent="var(--c-teal)"
        />
        <StatCard
          label="Per person"
          :value="money(store.perPersonSpend)"
          :hint="`party of ${store.trip.partySize}`"
          icon="sparkles"
          accent="var(--c-sun)"
        />
      </section>

      <div class="cols">
        <section class="card card-pad">
          <div class="section-title">
            <AppIcon name="wallet" :size="18" />
            <h2>Line items</h2>
          </div>

          <form class="additem" @submit.prevent="addItem">
            <input
              v-model="draft.label"
              class="input"
              placeholder="What is it? e.g. Park-to-park upgrade"
              aria-label="Item label"
            />
            <select v-model="draft.category" class="select" aria-label="Category">
              <option v-for="c in BUDGET_CATEGORIES" :key="c" :value="c">
                {{ c }}
              </option>
            </select>
            <input
              v-model="draft.amount"
              class="input additem__amount"
              type="number"
              min="0"
              step="10"
              placeholder="$"
              aria-label="Amount"
            />
            <select v-model="draft.day" class="select" aria-label="Day">
              <option value="">Whole trip</option>
              <option v-for="n in store.dayCount" :key="n" :value="n - 1">
                Day {{ n }}
              </option>
            </select>
            <label class="additem__paid">
              <input v-model="draft.paid" type="checkbox" /> Paid
            </label>
            <button type="submit" class="btn btn-primary">
              <AppIcon name="plus" :size="15" /> Add
            </button>
          </form>

          <ul v-if="store.budget.length" role="list" class="items">
            <li v-for="item in store.budget" :key="item.id" class="item">
              <div class="item__main">
                <span class="item__label">{{ item.label }}</span>
                <span class="item__meta muted">
                  {{ item.category }}
                  <template v-if="item.day !== null">
                    · Day {{ item.day + 1 }}
                  </template>
                </span>
              </div>
              <label class="item__paid" :title="item.paid ? 'Paid' : 'Not paid'">
                <input
                  type="checkbox"
                  :checked="item.paid"
                  @change="
                    store.updateBudgetItem(item.id, {
                      paid: ($event.target as HTMLInputElement).checked,
                    })
                  "
                />
              </label>
              <div class="item__amount">
                <span class="item__sign">$</span>
                <input
                  class="input"
                  type="number"
                  min="0"
                  step="10"
                  :value="item.amount"
                  @change="
                    store.updateBudgetItem(item.id, {
                      amount: Math.max(
                        0,
                        Number(($event.target as HTMLInputElement).value) || 0,
                      ),
                    })
                  "
                />
              </div>
              <button
                type="button"
                class="btn btn-icon btn-ghost btn-sm item__del"
                title="Delete"
                @click="store.removeBudgetItem(item.id)"
              >
                <AppIcon name="trash" :size="15" />
              </button>
            </li>
          </ul>
          <EmptyState
            v-else
            icon="wallet"
            title="No costs added yet"
            message="Start with the big three: tickets, hotel and flights."
          />
        </section>

        <section class="card card-pad">
          <div class="section-title">
            <AppIcon name="list" :size="18" />
            <h2>By category</h2>
          </div>
          <div v-if="categoryRows.length" class="catbars">
            <div v-for="row in categoryRows" :key="row.category" class="catbar">
              <div class="catbar__top">
                <span>{{ row.category }}</span>
                <span class="muted">{{ money(row.amount) }}</span>
              </div>
              <div class="catbar__track">
                <div
                  class="catbar__fill"
                  :style="{ width: `${(row.amount / maxCategory) * 100}%` }"
                />
              </div>
            </div>
          </div>
          <p v-else class="muted">Add a line item to see the breakdown.</p>
        </section>
      </div>

      <template #fallback>
        <div class="card sk" />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.summary {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin-bottom: 20px;
}
.total-card {
  display: grid;
  gap: 14px;
  align-content: start;
}
.total-input {
  display: flex;
  align-items: center;
  gap: 6px;
}
.total-input__sign {
  font-weight: 700;
  color: var(--text-muted);
}
.cols {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 18px;
}
@media (max-width: 860px) {
  .cols {
    grid-template-columns: 1fr;
  }
}

.additem {
  display: grid;
  grid-template-columns: 1.6fr 1fr 90px 1fr auto auto;
  gap: 8px;
  margin-bottom: 14px;
}
.additem__amount {
  width: 100%;
}
.additem__paid {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}
@media (max-width: 720px) {
  .additem {
    grid-template-columns: 1fr 1fr;
  }
  .additem > .input:first-child {
    grid-column: 1 / -1;
  }
}

.items {
  display: grid;
  gap: 2px;
}
.item {
  display: grid;
  grid-template-columns: 1fr auto 116px auto;
  gap: 10px;
  align-items: center;
  padding: 9px 0;
  border-top: 1px solid var(--border);
}
.item:first-child {
  border-top: 0;
}
.item__main {
  min-width: 0;
}
.item__label {
  font-weight: 600;
}
.item__meta {
  display: block;
  font-size: 0.8rem;
}
.item__amount {
  display: flex;
  align-items: center;
  gap: 4px;
}
.item__amount .input {
  padding: 6px 8px;
  text-align: right;
}
.item__sign {
  color: var(--text-faint);
  font-size: 0.85rem;
}
.item__del:hover {
  color: var(--danger);
}

.catbars {
  display: grid;
  gap: 12px;
}
.catbar__top {
  display: flex;
  justify-content: space-between;
  font-size: 0.86rem;
  font-weight: 600;
  margin-bottom: 4px;
}
.catbar__track {
  height: 10px;
  border-radius: var(--radius-pill);
  background: var(--bg-sunk);
  overflow: hidden;
  border: 1px solid var(--border);
}
.catbar__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--c-navy), var(--c-teal));
  border-radius: inherit;
}
.sk {
  min-height: 300px;
}
</style>
