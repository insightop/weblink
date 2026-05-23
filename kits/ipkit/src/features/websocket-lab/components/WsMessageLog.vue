<script setup lang="ts">
import { NList, NListItem, NThing, NTag, NSpace } from "naive-ui";
import type { WsLogEntry } from "../stores/wsLab.store";

defineProps<{
  entries: WsLogEntry[];
}>();

function dirLabel(d: WsLogEntry["direction"]): string {
  if (d === "in") {
    return "收";
  }
  if (d === "out") {
    return "发";
  }
  return "系统";
}

function dirType(d: WsLogEntry["direction"]): "default" | "success" | "info" {
  if (d === "in") {
    return "success";
  }
  if (d === "out") {
    return "info";
  }
  return "default";
}
</script>

<template>
  <NList bordered>
    <NListItem v-for="e in entries" :key="e.id">
      <NThing>
        <template #header>
          <NSpace align="center" size="small">
            <NTag size="small" :type="dirType(e.direction)">{{ dirLabel(e.direction) }}</NTag>
            <span class="time">{{ new Date(e.t).toLocaleTimeString() }}</span>
          </NSpace>
        </template>
        <pre class="payload">{{ e.text }}</pre>
      </NThing>
    </NListItem>
  </NList>
</template>

<style scoped>
.time {
  font-size: 12px;
  opacity: 0.7;
}
.payload {
  margin: 8px 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
}
</style>
