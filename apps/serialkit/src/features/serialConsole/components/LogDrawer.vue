<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { LogEntry, LogLevel } from "@/domain/logs/logEntry";

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

const listRef = ref<HTMLElement | null>(null);

const levelOptions: Array<{ id: LogLevel | "all"; label: string }> = [
  { id: "all", label: "全部" },
  { id: "debug", label: "Debug" },
  { id: "info", label: "Info" },
  { id: "warn", label: "Warn" },
  { id: "error", label: "Error" },
];

const canClear = computed(() => props.logs.length > 0);
const SCROLL_THRESHOLD_PX = 8;

const displayedLogs = computed(() => [...props.logs].reverse());

const followHead = ref(true);

function scrollToTop(): void {
  const el = listRef.value;
  if (!el) return;
  el.scrollTop = 0;
}

function isAtTop(el: HTMLElement): boolean {
  return el.scrollTop <= SCROLL_THRESHOLD_PX;
}

function onUserScroll(): void {
  const el = listRef.value;
  if (!el) return;
  // 最新在最上：用户离开顶部则暂停；回到顶部则恢复
  followHead.value = isAtTop(el);
}

watch(
  () => props.logs.length,
  () => {
    if (followHead.value) scrollToTop();
  },
);

onMounted(() => {
  if (followHead.value) scrollToTop();
});
</script>

<template>
  <div class="drawer">
    <div class="drawer__head">
      <div class="drawer__title">日志</div>
      <button type="button" class="btn" :disabled="!canClear" @click="emit('clear')">清空</button>
    </div>

    <div class="drawer__filters">
      <select class="field" :value="level" @change="emit('update:level', ($event.target as HTMLSelectElement).value as any)">
        <option v-for="o in levelOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
      </select>
      <input
        class="field"
        type="search"
        placeholder="过滤关键字"
        :value="keyword"
        @input="emit('update:keyword', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <div ref="listRef" class="drawer__list" @scroll="onUserScroll">
      <div v-if="displayedLogs.length === 0" class="empty">暂无日志</div>
      <div v-for="l in displayedLogs" :key="l.id" class="item" :class="'item--' + l.level">
        <div class="item__meta">
          <span class="item__ts">{{ new Date(l.ts).toLocaleTimeString() }}</span>
          <span class="item__scope">{{ l.scope }}</span>
        </div>
        <div class="item__msg">{{ l.message }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}
.drawer__title {
  font-weight: 700;
}
.drawer__filters {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}
.field {
  width: 100%;
  padding: 0.45rem 0.55rem;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text);
}
.check {
  display: inline-flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.9rem;
  color: var(--color-muted);
}
.btn {
  padding: 0.35rem 0.6rem;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text);
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.drawer__list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.75rem;
}
.empty {
  color: var(--color-muted);
}
.item {
  padding: 0.5rem 0.55rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.12);
  margin-bottom: 0.5rem;
}
.item__meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: var(--color-muted);
}
.item__msg {
  margin-top: 0.15rem;
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-word;
}
.item--error { border-color: rgba(255, 107, 107, 0.35); }
.item--warn { border-color: rgba(255, 214, 102, 0.25); }
</style>
