<script setup lang="ts">
import { NProgress, NText } from "naive-ui";

const props = defineProps<{ percent: number; stage: string; bytesPerSecond: number; etaSeconds: number | null }>();

const formatSpeed = (bytesPerSecond: number): string => {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "--";
  if (bytesPerSecond >= 1024 * 1024) return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
  if (bytesPerSecond >= 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${bytesPerSecond.toFixed(0)} B/s`;
};

const formatEta = (etaSeconds: number | null): string => {
  if (etaSeconds === null || etaSeconds < 0) return "--";
  const minutes = Math.floor(etaSeconds / 60);
  const seconds = etaSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
};
</script>

<template>
  <section class="progress-wrap">
    <NProgress
      type="line"
      :show-indicator="false"
      :percentage="percent"
      :processing="props.stage === 'flashing'"
      :height="10"
      border-radius="999px"
    />
    <div class="meta">
      <NText depth="2">Stage: {{ stage }}</NText>
      <NText depth="2">{{ formatSpeed(props.bytesPerSecond) }} | {{ formatEta(props.etaSeconds) }}</NText>
    </div>
  </section>
</template>

<style scoped>
.progress-wrap { display: grid; gap: 8px; }
.meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  color: var(--text-muted);
}
</style>
