<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { formatTimeMs } from "@weblink/utils/time";

const props = defineProps<{
  lines: Array<{ ts: number; text: string; hex: string }>;
}>();

const emit = defineEmits<{
  (e: "clear"): void;
}>();

const listRef = ref<HTMLElement | null>(null);
const count = computed(() => props.lines.length);
const followTail = ref(true);

const SCROLL_THRESHOLD_PX = 8;

function isAtBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD_PX;
}

function scrollToBottom(): void {
  const el = listRef.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

function onUserScroll(): void {
  const el = listRef.value;
  if (!el) return;
  // 智能滚动：用户离开底部则暂停；回到底部则恢复
  followTail.value = isAtBottom(el);
}

watch(
  () => props.lines.length,
  () => {
    if (!followTail.value) return;
    scrollToBottom();
  },
);

onMounted(() => {
  scrollToBottom();
});
</script>

<template>
  <section class="card">
    <div class="card__head">
      <div class="card__title">接收</div>
      <div class="card__actions">
        <span class="meta">{{ count }} 行</span>
        <button type="button" class="btn" @click="emit('clear')">清空</button>
      </div>
    </div>

    <div class="table">
      <div class="table__head">
        <div class="table__cell table__cell--ts">时间</div>
        <div class="table__cell">Text</div>
        <div class="table__cell table__cell--hex">Hex</div>
      </div>

      <div ref="listRef" class="table__body" @scroll="onUserScroll">
        <div v-if="lines.length === 0" class="empty">暂无数据</div>
        <div v-for="(l, i) in lines" :key="i" class="row">
          <div class="cell cell--ts">{{ formatTimeMs(l.ts) }}</div>
          <div class="cell">{{ l.text }}</div>
          <div class="cell cell--hex">{{ l.hex }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.card {
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.04);
  border-radius: var(--radius);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.card__title {
  font-weight: 800;
}
.card__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.meta {
  font-size: 0.8rem;
  color: var(--color-muted);
}
.btn {
  padding: 0.45rem 0.7rem;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text);
  cursor: pointer;
}
.table {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.18);
  overflow: hidden;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.table__head {
  display: grid;
  grid-template-columns: 140px 1fr 1fr;
  gap: 0;
  padding: 0.5rem 0.65rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--color-muted);
  font-size: 0.78rem;
}
.table__cell--hex {
  font-family: var(--font-mono);
}
.table__cell--ts {
  font-variant-numeric: tabular-nums;
}
.table__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.row {
  display: grid;
  grid-template-columns: 140px 1fr 1fr;
  padding: 0.45rem 0.65rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  gap: 0.75rem;
}
.row:last-child {
  border-bottom: none;
}
.cell {
  min-width: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.9rem;
}
.cell--hex {
  font-family: var(--font-mono);
}
.cell--ts {
  font-variant-numeric: tabular-nums;
  color: var(--color-muted);
  font-size: 0.82rem;
}
.empty {
  padding: 0.75rem;
  color: var(--color-muted);
}
@media (max-width: 900px) {
  .table__head,
  .row {
    grid-template-columns: 120px 1fr;
  }
  .table__head .table__cell--hex {
    display: none;
  }
  .row .cell--hex {
    grid-column: 1 / -1;
    opacity: 0.85;
  }
}
</style>
