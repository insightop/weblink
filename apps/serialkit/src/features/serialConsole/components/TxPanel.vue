<script setup lang="ts">
import { computed } from "vue";
import type { LineEnding } from "@/domain/serial/text";
import { formatTimeMs } from "@/shared/utils/time";

const props = defineProps<{
  mode: "text" | "hex";
  text: string;
  hex: string;
  lineEnding: LineEnding;
  canSend: boolean;
  lastTxTs: number | null;
}>();

const emit = defineEmits<{
  (e: "update:mode", v: "text" | "hex"): void;
  (e: "update:text", v: string): void;
  (e: "update:hex", v: string): void;
  (e: "update:lineEnding", v: LineEnding): void;
  (e: "send"): void;
}>();

const placeholder = computed(() =>
  props.mode === "text" ? "输入文本…" : "输入 Hex（如 01 03 00 00 00 02 C4 0B）…",
);
</script>

<template>
  <section class="card">
    <div class="card__head">
      <div class="card__title">发送</div>
      <div class="card__actions">
        <select class="field" :value="mode" @change="emit('update:mode', ($event.target as HTMLSelectElement).value as any)">
          <option value="text">Text</option>
          <option value="hex">Hex</option>
        </select>
        <select
          v-if="mode === 'text'"
          class="field"
          :value="lineEnding"
          @change="emit('update:lineEnding', ($event.target as HTMLSelectElement).value as any)"
        >
          <option value="none">不追加行尾</option>
          <option value="lf">追加 LF (\n)</option>
          <option value="crlf">追加 CRLF (\r\n)</option>
        </select>
        <span v-if="lastTxTs" class="meta">上次：{{ formatTimeMs(lastTxTs) }}</span>
        <button type="button" class="btn" :disabled="!canSend" @click="emit('send')">发送</button>
      </div>
    </div>

    <textarea
      class="textarea"
      rows="4"
      :placeholder="placeholder"
      :value="mode === 'text' ? text : hex"
      @input="
        mode === 'text'
          ? emit('update:text', ($event.target as HTMLTextAreaElement).value)
          : emit('update:hex', ($event.target as HTMLTextAreaElement).value)
      "
    />
  </section>
</template>

<style scoped>
.card {
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.04);
  border-radius: var(--radius);
  padding: 0.75rem;
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
  font-variant-numeric: tabular-nums;
}
.field {
  padding: 0.45rem 0.55rem;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text);
}
.btn {
  padding: 0.45rem 0.75rem;
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
.textarea {
  width: 100%;
  padding: 0.65rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.18);
  color: var(--color-text);
  resize: vertical;
}
</style>
