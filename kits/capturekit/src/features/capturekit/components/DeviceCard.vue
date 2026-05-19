<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>

<template>
  <section class="device-card">
    <h2 class="device-card__title">{{ title }}</h2>

    <div class="device-card__toolbar">
      <slot name="toolbar" />
    </div>

    <div v-if="$slots.errors" class="device-card__errors">
      <slot name="errors" />
    </div>

    <div class="device-card__main">
      <slot name="main" />
    </div>
  </section>
</template>

<style scoped>
.device-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
}
.device-card__title {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
  font-weight: 600;
}
.device-card__toolbar {
  display: flex;
  align-items: stretch;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.device-card__toolbar :deep(.device-card__select) {
  flex: 1;
  min-width: 0;
  padding: 0.45rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.9rem;
}
.device-card__toolbar :deep(.device-card__btn) {
  flex-shrink: 0;
  padding: 0.45rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.9rem;
  white-space: nowrap;
  cursor: pointer;
}
.device-card__toolbar :deep(.device-card__btn:disabled) {
  opacity: 0.6;
  cursor: not-allowed;
}
.device-card__toolbar :deep(.device-card__btn--active) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.device-card__errors {
  margin-bottom: 0.5rem;
  min-height: 0;
}
.device-card__errors :deep(.device-card__error) {
  color: var(--color-danger);
  font-size: 0.85rem;
  margin: 0 0 0.35rem;
}
.device-card__errors :deep(.device-card__error:last-child) {
  margin-bottom: 0;
}
.device-card__errors :deep(.device-card__warn) {
  font-size: 0.8rem;
  color: #d4a72c;
  margin: 0 0 0.35rem;
}
.device-card__main {
  flex: 1;
  min-height: 5rem;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
</style>
