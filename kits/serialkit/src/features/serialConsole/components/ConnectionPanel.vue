<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  state: "idle" | "connected" | "disconnected";
  lastError: string | null;
  baudRate: number;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: SerialParity;
  flowControl: SerialFlowControl;
}>();

const emit = defineEmits<{
  (e: "update:baudRate", v: number): void;
  (e: "update:dataBits", v: 7 | 8): void;
  (e: "update:stopBits", v: 1 | 2): void;
  (e: "update:parity", v: SerialParity): void;
  (e: "update:flowControl", v: SerialFlowControl): void;
  (e: "selectPort"): void;
  (e: "disconnect"): void;
}>();

const connected = computed(() => props.state === "connected");
</script>

<template>
  <section class="card">
    <div class="card__head">
      <div class="card__title">连接</div>
      <div class="card__actions">
        <button type="button" class="btn" :disabled="connected" @click="emit('selectPort')">
          选择端口并连接
        </button>
        <button type="button" class="btn" :disabled="!connected" @click="emit('disconnect')">
          断开
        </button>
      </div>
    </div>

    <div class="grid">
      <label class="field">
        <span class="field__label">波特率</span>
        <input
          class="field__control"
          type="number"
          min="300"
          step="1"
          :disabled="connected"
          :value="baudRate"
          @input="emit('update:baudRate', Number(($event.target as HTMLInputElement).value))"
        >
      </label>

      <label class="field">
        <span class="field__label">数据位</span>
        <select
          class="field__control"
          :disabled="connected"
          :value="dataBits"
          @change="emit('update:dataBits', Number(($event.target as HTMLSelectElement).value) as 7 | 8)"
        >
          <option :value="8">8</option>
          <option :value="7">7</option>
        </select>
      </label>

      <label class="field">
        <span class="field__label">停止位</span>
        <select
          class="field__control"
          :disabled="connected"
          :value="stopBits"
          @change="emit('update:stopBits', Number(($event.target as HTMLSelectElement).value) as 1 | 2)"
        >
          <option :value="1">1</option>
          <option :value="2">2</option>
        </select>
      </label>

      <label class="field">
        <span class="field__label">校验</span>
        <select
          class="field__control"
          :disabled="connected"
          :value="parity"
          @change="emit('update:parity', ($event.target as HTMLSelectElement).value as SerialParity)"
        >
          <option value="none">none</option>
          <option value="even">even</option>
          <option value="odd">odd</option>
        </select>
      </label>

      <label class="field">
        <span class="field__label">流控</span>
        <select
          class="field__control"
          :disabled="connected"
          :value="flowControl"
          @change="emit('update:flowControl', ($event.target as HTMLSelectElement).value as SerialFlowControl)"
        >
          <option value="none">none</option>
          <option value="hardware">hardware</option>
        </select>
      </label>

      <div class="status">
        <span class="pill" :class="'pill--' + state">{{ state }}</span>
        <span v-if="lastError" class="err">{{ lastError }}</span>
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
  gap: 0.5rem;
}
.btn {
  padding: 0.45rem 0.7rem;
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
.grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.6rem;
  align-items: end;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.field__label {
  font-size: 0.78rem;
  color: var(--color-muted);
}
.field__control {
  padding: 0.45rem 0.55rem;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text);
}
.status {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.pill {
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  font-size: 0.8rem;
  color: var(--color-muted);
}
.pill--connected {
  color: var(--color-accent);
  border-color: rgba(110, 168, 254, 0.4);
}
.err {
  color: var(--color-danger);
  font-size: 0.85rem;
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
