<script setup lang="ts">
import { NButton, NIcon, NPopover } from "naive-ui";
import type { Component } from "vue";

defineProps<{
  title: string;
  subtitle?: string;
  titleIcon?: Component;
}>();
</script>

<template>
  <section class="zone">
    <header class="zone-title">
      <div class="title-col">
        <span class="title-main">
          <NIcon v-if="titleIcon" :component="titleIcon" :size="14" class="title-icon" />
          <span>{{ title }}</span>
        </span>
        <div v-if="subtitle || $slots.subtitleExtra" class="subtitle-row">
          <span v-if="subtitle" class="subtitle" :title="subtitle">
            {{ subtitle }}
          </span>
          <slot name="subtitleExtra" />
        </div>
      </div>
      <NPopover
        v-if="$slots.help"
        trigger="hover"
        placement="bottom-end"
        :show-arrow="true"
        :delay="180"
        scrollable
        class="help-popover"
      >
        <template #trigger>
          <NButton quaternary circle size="tiny" class="help-btn" aria-label="Help">
            ?
          </NButton>
        </template>
        <div class="help-popover-inner">
          <slot name="help" />
        </div>
      </NPopover>
    </header>
    <div class="zone-content">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.zone {
  border: 1px solid var(--border-default);
  border-radius: 14px;
  background: var(--surface-bg);
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}
.zone-title {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-default);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  font-size: 12px;
  text-transform: lowercase;
  letter-spacing: 0.04em;
  font-weight: 700;
  color: var(--text-muted);
}
.title-col {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.title-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.subtitle-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.subtitle {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: none;
  letter-spacing: normal;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.title-icon {
  color: var(--text-muted);
}
.help-btn {
  color: var(--text-muted);
}
.zone-content {
  padding: 14px;
  display: grid;
  gap: 12px;
}
.help-popover-inner {
  width: fit-content;
  max-width: min(640px, 92vw);
  min-width: min(200px, 92vw);
  max-height: min(70vh, 560px);
  overflow: auto;
}
</style>
