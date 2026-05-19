<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { NIcon, NTag } from "naive-ui";
import type { LogEntry, LogLevel } from "../types/log";
import { getLogLevelPresentation } from "../presentation/logLevelPresentation";

const props = withDefaults(
  defineProps<{
    logs: LogEntry[];
    emptyText?: string;
    showFilters?: boolean;
    showClear?: boolean;
    autoScroll?: boolean;
    levelFilter?: LogLevel | "all";
    keyword?: string;
    getLevelLabel?: (level: LogLevel) => string;
  }>(),
  {
    emptyText: "No log entries.",
    showFilters: false,
    showClear: false,
    autoScroll: true,
    levelFilter: "all",
    keyword: "",
  },
);

const emit = defineEmits<{
  (e: "update:levelFilter", v: LogLevel | "all"): void;
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
const followHead = ref(true);

function levelLabel(level: LogLevel): string {
  return props.getLevelLabel ? props.getLevelLabel(level) : level;
}

const formatTime = (ts: number): string => {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
};

const formatContext = (ctx: unknown): string => {
  if (ctx === undefined) return "";
  try {
    const s = JSON.stringify(ctx);
    return s.length > 600 ? `${s.slice(0, 600)}…` : s;
  } catch {
    return String(ctx);
  }
};

const displayedLogs = computed(() => [...props.logs].reverse());

function scrollToTop(): void {
  const el = listRef.value;
  if (!el) return;
  el.scrollTop = 0;
}

function onUserScroll(): void {
  const el = listRef.value;
  if (!el) return;
  followHead.value = el.scrollTop <= SCROLL_THRESHOLD_PX;
}

watch(
  () => props.logs.length,
  () => {
    if (props.autoScroll && followHead.value) scrollToTop();
  },
);

onMounted(() => {
  if (props.autoScroll && followHead.value) scrollToTop();
});
</script>

<template>
  <div class="console">
    <div v-if="showFilters || showClear" class="console__toolbar">
      <div v-if="showFilters" class="console__filters">
        <select
          class="console__field"
          :value="levelFilter"
          @change="emit('update:levelFilter', ($event.target as HTMLSelectElement).value as any)"
        >
          <option v-for="o in levelOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
        </select>
        <input
          class="console__field"
          type="search"
          placeholder="过滤关键字"
          :value="keyword"
          @input="emit('update:keyword', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <button
        v-if="showClear"
        type="button"
        class="console__btn"
        :disabled="!canClear"
        @click="emit('clear')"
      >
        清空
      </button>
    </div>

    <div ref="listRef" class="console__list" @scroll="onUserScroll">
      <article v-for="entry in displayedLogs" :key="entry.id" class="line">
        <div class="meta-col">
          <span class="ts">{{ formatTime(entry.ts) }}</span>
          <NTag class="lvl-tag" :data-level="entry.level" size="small" :bordered="false">
            <span class="lvl-inner">
              <NIcon :component="getLogLevelPresentation(entry.level).icon" :size="10" />
              {{ levelLabel(entry.level) }}
            </span>
          </NTag>
          <span v-if="entry.scope" class="scope">{{ entry.scope }}</span>
        </div>
        <div class="msg-col">
          <div class="msg">
            {{ entry.message }}
          </div>
          <div v-if="entry.data !== undefined" class="ctx">
            <pre class="ctx-body">{{ formatContext(entry.data) }}</pre>
          </div>
        </div>
      </article>
      <div v-if="displayedLogs.length === 0" class="empty">
        {{ emptyText }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.console {
  margin: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--log-surface-bg);
  color: var(--log-text-primary);
  border-radius: 10px;
  min-height: 220px;
}
.console__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--log-border);
}
.console__filters {
  display: flex;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}
.console__field {
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--log-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--log-text-primary);
  font-size: 12px;
}
.console__field[type="search"] {
  flex: 1;
  min-width: 0;
}
.console__btn {
  padding: 0.3rem 0.55rem;
  border-radius: 8px;
  border: 1px solid var(--log-border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--log-text-primary);
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}
.console__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.console__list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 6px 4px;
  font-size: 12px;
  line-height: 1.5;
  display: grid;
  gap: 8px;
  align-content: start;
}
.line {
  display: grid;
  grid-template-columns: fit-content(76px) 1fr;
  gap: 5px;
  border: 1px solid var(--log-border);
  border-radius: 10px;
  padding: 5px 5px;
  background: var(--log-card-bg);
}
.meta-col {
  display: grid;
  gap: 2px;
  align-content: start;
  justify-items: start;
  min-width: 0;
}
.ts {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  font-size: 9px;
}
.scope {
  color: var(--text-secondary);
  font-size: 9px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.lvl-tag :deep(.n-tag__content) {
  font-weight: 700;
  letter-spacing: 0.01em;
  font-size: 9px;
}
.lvl-inner {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.lvl-tag {
  --n-height: 14px;
  --n-padding: 0 4px;
}
.lvl-tag[data-level="trace"] {
  background: var(--trace-500);
  color: #ffffff;
}
.lvl-tag[data-level="debug"] {
  background: var(--debug-500);
  color: #ffffff;
}
.lvl-tag[data-level="info"] {
  background: var(--info-500);
  color: #ffffff;
}
.lvl-tag[data-level="warn"],
.lvl-tag[data-level="warning"] {
  background: var(--warning-500);
  color: #ffffff;
}
.lvl-tag[data-level="error"] {
  background: var(--error-500);
  color: #ffffff;
}
.msg-col {
  min-width: 0;
  display: grid;
  gap: 4px;
}
.msg {
  color: var(--log-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}
.ctx-body {
  margin: 0;
  font-size: 10px;
  line-height: 1.35;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}
.empty {
  color: var(--text-muted);
}
</style>
