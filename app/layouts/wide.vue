<template>
  <div class="wide-shell">
    <AppHeader />
    <slot />
  </div>
</template>

<style scoped>
.wide-shell {
  width: 100%;
  min-height: 100dvh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--app-bg);
}
</style>
