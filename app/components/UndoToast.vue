<script setup lang="ts">
const store = useTripStore()
let timer: ReturnType<typeof setTimeout> | undefined

watch(
  () => store.undo,
  (entry) => {
    clearTimeout(timer)
    if (entry) timer = setTimeout(() => store.clearUndo(), 6000)
  },
)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <Transition name="undo">
    <div v-if="store.undo && !store.sheetOpen" class="undo-toast" role="status" aria-live="polite">
      <span>{{ store.undo.label }}</span>
      <button type="button" @click="store.undoLastChange()">Undo</button>
    </div>
  </Transition>
</template>

<style scoped>
.undo-toast {
  position:fixed;
  z-index:80;
  left:50%;
  bottom:max(18px, env(safe-area-inset-bottom));
  width:min(calc(100% - 28px), 420px);
  transform:translateX(-50%);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  padding:12px 14px;
  border-radius:14px;
  background:#17233a;
  color:#fff;
  box-shadow:0 10px 28px rgb(11 20 39 / 28%);
  font-size:13px;
  font-weight:600;
}
.undo-toast button { color:#ffd36a; font-weight:800; }
.undo-enter-active,.undo-leave-active { transition:opacity .16s ease, transform .16s ease; }
.undo-enter-from,.undo-leave-to { opacity:0; transform:translate(-50%, 8px); }
@media (prefers-reduced-motion:reduce) {
  .undo-enter-active,.undo-leave-active { transition:none; }
}
</style>
