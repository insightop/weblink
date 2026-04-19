<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { LogEntry, LogLevel } from "@/domain/logs/logEntry";
import { formatTimeMs } from "@/shared/utils/time";

const props = defineProps<{
  logs: LogEntry[];
  level: LogLevel | "all";
  keyword: string;
}>();

const emit = defineEmits<{
  (e: "update:level", v: LogLevel | "all"): void;
  (e: "update:keyword", v: string): void;
  (e: "clear"): void;
}>();

const scroller = ref<HTMLDivElement | null>(null);
const followHead = ref(true);
const SCROLL_THRESHOLD_PX = 12;

const shown = computed(() => props.logs.slice().reverse());

function onScroll() {
  const el = scroller.value;
  if (!el) return;
  followHead.value = el.scrollTop <= SCROLL_THRESHOLD_PX;
}

async function maybeStickHead() {
  if (!followHead.value) return;
  await nextTick();
  const el = scroller.value;
  if (!el) return;
  el.scrollTop = 0;
}

watch(
  () => props.logs.length,
  () => {
    void maybeStickHead();
  },
);

onMounted(() => {
  void maybeStickHead();
});
</script>

<template>
  <div class="drawer">
    <header class="drawer__head">
      <div class="drawer__title">日志</div>
      <div class="drawer__actions">
        <select
          class="sel"
          :value="props.level"
          @change="
            emit('update:level', ($event.target as HTMLSelectElement).value as LogLevel | 'all')
          "
        >
          <option value="all">全部</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        <input
          class="inp"
          placeholder="搜索"
          :value="props.keyword"
          @input="emit('update:keyword', ($event.target as HTMLInputElement).value)"
        >
        <button type="button" class="btn" @click="emit('clear')">清空</button>
      </div>
    </header>

    <div ref="scroller" class="drawer__body" @scroll="onScroll">
      <div v-if="shown.length === 0" class="drawer__muted">暂无日志</div>
      <div v-for="e in shown" :key="e.id" class="row" :class="`row--${e.level}`">
        <div class="row__meta">
          <span class="row__ts">{{ formatTimeMs(e.ts) }}</span>
          <span class="row__scope">{{ e.scope }}</span>
          <span class="row__lvl">{{ e.level }}</span>
        </div>
        <div class="row__msg">{{ e.message }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drawer {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.7rem;
  border-bottom: 1px solid var(--color-border);
}
.drawer__title {
  font-weight: 800;
}
.drawer__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.sel,
.inp {
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text);
  border-radius: 10px;
  padding: 0.35rem 0.55rem;
}
.inp {
  width: 120px;
}
.btn {
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text);
  border-radius: 10px;
  padding: 0.35rem 0.55rem;
  cursor: pointer;
}
.drawer__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.5rem 0.65rem;
}
.drawer__muted {
  color: var(--color-muted);
  font-size: 0.9rem;
}
.row {
  padding: 0.45rem 0.35rem;
  border-radius: 8px;
  margin-bottom: 0.35rem;
  background: rgba(255, 255, 255, 0.03);
}
.row--debug {
  border-left: 3px solid rgba(255, 255, 255, 0.25);
}
.row--info {
  border-left: 3px solid var(--color-accent);
}
.row--warn {
  border-left: 3px solid rgba(255, 214, 102, 0.9);
}
.row--error {
  border-left: 3px solid var(--color-danger);
}
.row__meta {
  display: flex;
  gap: 0.45rem;
  align-items: baseline;
  font-size: 0.72rem;
  color: var(--color-muted);
  margin-bottom: 0.2rem;
}
.row__scope {
  font-family: var(--font-mono);
}
.row__lvl {
  margin-left: auto;
  opacity: 0.85;
}
.row__msg {
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
