<script setup lang="ts">
defineProps<{
  rightOpen: boolean;
  rightWidthPx?: number;
}>();

defineEmits<{
  (e: "update:rightOpen", v: boolean): void;
}>();
</script>

<template>
  <div class="split">
    <div class="split__main">
      <slot name="main" />
    </div>

    <aside
      class="split__right"
      :class="{ 'split__right--closed': !rightOpen }"
      :style="{ width: (rightWidthPx ?? 320) + 'px' }"
    >
      <slot name="right" />
    </aside>

    <button
      type="button"
      class="split__toggle"
      :aria-expanded="rightOpen"
      @click="$emit('update:rightOpen', !rightOpen)"
    >
      {{ rightOpen ? "收起日志" : "展开日志" }}
    </button>
  </div>
</template>

<style scoped>
.split {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
  padding: 0.75rem;
  height: 100%;
  min-height: 0;
}
.split__main {
  min-width: 0;
  min-height: 0;
}
.split__right {
  min-width: 0;
  min-height: 0;
  border-left: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  overflow: hidden;
  transition: width 0.16s ease, opacity 0.16s ease;
}
.split__right--closed {
  width: 0 !important;
  opacity: 0;
  border: none;
}
.split__toggle {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text);
  cursor: pointer;
}
@media (max-width: 900px) {
  .split {
    grid-template-columns: 1fr;
  }
  .split__right {
    width: 100% !important;
    border-left: none;
    border-top: 1px solid var(--color-border);
  }
  .split__right--closed {
    display: none;
  }
}
</style>
