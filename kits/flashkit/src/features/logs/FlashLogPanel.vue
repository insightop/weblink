<script setup lang="ts">
import { NCard, NScrollbar } from "naive-ui";

defineProps<{
  lines: readonly string[];
}>();
</script>

<template>
  <n-card title="日志" size="small">
    <n-scrollbar style="max-height: 240px">
      <pre style="margin: 0; white-space: pre-wrap; font-size: 12px">{{ lines.join("\n") }}</pre>
    </n-scrollbar>
  </n-card>
</template>
