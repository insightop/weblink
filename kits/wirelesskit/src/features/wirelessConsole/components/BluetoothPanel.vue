<script setup lang="ts">
import { computed } from "vue";

type RxRow = { id: string; ts: number; text: string; hex: string };

const props = defineProps<{
  vm: {
    deviceName: { value: string };
    connected: { value: boolean };
    busy: { value: boolean };
    error: { value: string | null };
    optionalServices: { value: string };
    services: { value: BluetoothRemoteGATTService[] };
    serviceUuid: { value: string };
    characteristics: { value: BluetoothRemoteGATTCharacteristic[] };
    characteristicUuid: { value: string };
    txMode: { value: "text" | "hex" };
    txText: { value: string };
    txHex: { value: string };
    lastRead: { value: { ts: number; text: string; hex: string } | null };
    notifyOn: { value: boolean };
    rx: { value: RxRow[] };
    pickDevice: () => Promise<void>;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    refreshServices: () => Promise<void>;
    refreshCharacteristics: () => Promise<void>;
    read: () => Promise<void>;
    write: () => Promise<void>;
    startNotify: () => Promise<void>;
    stopNotify: () => Promise<void>;
    clearRx: () => void;
    formatTimeMs: (ts: number) => string;
  };
}>();

const canConnect = computed(() => !!props.vm.deviceName.value && !props.vm.connected.value);
const canDisconnect = computed(() => props.vm.connected.value);
const hasSelection = computed(
  () => !!props.vm.serviceUuid.value.trim() && !!props.vm.characteristicUuid.value.trim(),
);
</script>

<template>
  <section class="card">
    <header class="card__head">
      <h2 class="card__title">Bluetooth</h2>
      <span class="card__muted">Web Bluetooth</span>
    </header>

    <div class="grid">
      <div class="row">
        <label class="lab">Optional Services</label>
        <input
          class="inp"
          placeholder="例：battery_service, device_information 或 0x180F"
          :value="vm.optionalServices.value"
          @input="vm.optionalServices.value = ($event.target as HTMLInputElement).value"
        />
      </div>

      <div class="row row--buttons">
        <div class="meta">
          <div class="name">{{ vm.deviceName.value || "未选择设备" }}</div>
          <div class="hint">
            {{ vm.connected.value ? "已连接" : "未连接" }}
            <span v-if="vm.busy.value" class="dot">·</span>
            <span v-if="vm.busy.value">处理中…</span>
          </div>
        </div>

        <div class="btns">
          <button type="button" class="btn" :disabled="vm.busy.value" @click="vm.pickDevice">
            选择设备
          </button>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="vm.busy.value || !canConnect"
            @click="vm.connect"
          >
            连接
          </button>
          <button
            type="button"
            class="btn btn--danger"
            :disabled="vm.busy.value || !canDisconnect"
            @click="vm.disconnect"
          >
            断开
          </button>
        </div>
      </div>

      <div v-if="vm.error.value" class="err">{{ vm.error.value }}</div>

      <div class="row row--two">
        <div class="col">
          <div class="row__head">
            <label class="lab">Service</label>
            <button
              type="button"
              class="btn btn--ghost"
              :disabled="vm.busy.value || !vm.connected.value"
              @click="vm.refreshServices"
            >
              刷新
            </button>
          </div>
          <select
            class="sel"
            :disabled="vm.busy.value || !vm.connected.value"
            :value="vm.serviceUuid.value"
            @change="
              vm.serviceUuid.value = ($event.target as HTMLSelectElement).value;
              vm.refreshCharacteristics();
            "
          >
            <option value="" disabled>请选择</option>
            <option v-for="s in vm.services.value" :key="s.uuid" :value="s.uuid">
              {{ s.uuid }}
            </option>
          </select>
        </div>

        <div class="col">
          <div class="row__head">
            <label class="lab">Characteristic</label>
            <button
              type="button"
              class="btn btn--ghost"
              :disabled="vm.busy.value || !vm.connected.value || !vm.serviceUuid.value"
              @click="vm.refreshCharacteristics"
            >
              刷新
            </button>
          </div>
          <select
            class="sel"
            :disabled="vm.busy.value || !vm.connected.value || !vm.serviceUuid.value"
            :value="vm.characteristicUuid.value"
            @change="vm.characteristicUuid.value = ($event.target as HTMLSelectElement).value"
          >
            <option value="" disabled>请选择</option>
            <option v-for="c in vm.characteristics.value" :key="c.uuid" :value="c.uuid">
              {{ c.uuid }}
            </option>
          </select>
        </div>
      </div>

      <div class="row row--buttons">
        <div class="btns">
          <button
            type="button"
            class="btn"
            :disabled="vm.busy.value || !vm.connected.value || !hasSelection"
            @click="vm.read"
          >
            Read
          </button>
          <button
            v-if="!vm.notifyOn.value"
            type="button"
            class="btn btn--primary"
            :disabled="vm.busy.value || !vm.connected.value || !hasSelection"
            @click="vm.startNotify"
          >
            开始 Notify
          </button>
          <button
            v-else
            type="button"
            class="btn btn--danger"
            :disabled="vm.busy.value"
            @click="vm.stopNotify"
          >
            停止 Notify
          </button>
          <button type="button" class="btn btn--ghost" :disabled="vm.busy.value" @click="vm.clearRx">
            清空接收
          </button>
        </div>
      </div>

      <div v-if="vm.lastRead.value" class="readback">
        <div class="readback__meta">{{ vm.formatTimeMs(vm.lastRead.value.ts) }}</div>
        <div class="readback__line">
          <span class="tag">Text</span>
          <span class="mono">{{ vm.lastRead.value.text }}</span>
        </div>
        <div class="readback__line">
          <span class="tag">Hex</span>
          <span class="mono">{{ vm.lastRead.value.hex }}</span>
        </div>
      </div>

      <div class="tx">
        <div class="tx__head">
          <label class="lab">Write</label>
          <div class="seg">
            <button
              type="button"
              class="seg__btn"
              :class="{ 'seg__btn--on': vm.txMode.value === 'text' }"
              @click="vm.txMode.value = 'text'"
            >
              Text
            </button>
            <button
              type="button"
              class="seg__btn"
              :class="{ 'seg__btn--on': vm.txMode.value === 'hex' }"
              @click="vm.txMode.value = 'hex'"
            >
              Hex
            </button>
          </div>
        </div>

        <textarea
          v-if="vm.txMode.value === 'text'"
          class="ta"
          rows="3"
          placeholder="输入要写入的文本"
          :value="vm.txText.value"
          @input="vm.txText.value = ($event.target as HTMLTextAreaElement).value"
        />
        <textarea
          v-else
          class="ta"
          rows="3"
          placeholder="输入 HEX，例如：01 03 00 00 00 02 C4 0B"
          :value="vm.txHex.value"
          @input="vm.txHex.value = ($event.target as HTMLTextAreaElement).value"
        />

        <div class="tx__actions">
          <button
            type="button"
            class="btn btn--primary"
            :disabled="vm.busy.value || !vm.connected.value || !hasSelection"
            @click="vm.write"
          >
            Write
          </button>
        </div>
      </div>

      <div class="rx">
        <div class="rx__head">
          <div class="lab">Notify 接收</div>
          <div class="rx__meta">{{ vm.rx.value.length }} 条</div>
        </div>
        <div class="rx__table">
          <div v-for="r in vm.rx.value" :key="r.id" class="rx__row">
            <div class="rx__ts">{{ vm.formatTimeMs(r.ts) }}</div>
            <div class="rx__cell mono">{{ r.text }}</div>
            <div class="rx__cell mono">{{ r.hex }}</div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.04);
  padding: 0.75rem;
}
.card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}
.card__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
}
.card__muted {
  color: var(--color-muted);
  font-size: 0.85rem;
}
.grid {
  margin-top: 0.6rem;
  display: grid;
  gap: 0.65rem;
}
.row {
  display: grid;
  gap: 0.35rem;
}
.row--buttons {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}
.row--two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.row__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.lab {
  color: var(--color-muted);
  font-size: 12px;
}
.inp,
.sel,
.ta {
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text);
  border-radius: 12px;
  padding: 0.5rem 0.6rem;
}
.ta {
  resize: vertical;
}
.btns {
  display: inline-flex;
  gap: 0.45rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.btn {
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text);
  border-radius: 12px;
  padding: 0.45rem 0.7rem;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn--primary {
  border-color: rgba(110, 168, 254, 0.4);
  background: rgba(110, 168, 254, 0.14);
}
.btn--danger {
  border-color: rgba(255, 107, 107, 0.35);
  background: rgba(255, 107, 107, 0.12);
}
.btn--ghost {
  background: transparent;
}
.meta .name {
  font-weight: 700;
}
.meta .hint {
  color: var(--color-muted);
  font-size: 12px;
  margin-top: 2px;
}
.dot {
  margin: 0 0.3rem;
}
.err {
  border: 1px solid rgba(255, 107, 107, 0.28);
  background: rgba(255, 107, 107, 0.12);
  padding: 0.55rem 0.65rem;
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.9);
}
.mono {
  font-family: var(--font-mono);
  font-size: 12px;
}
.readback {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.14);
  border-radius: 12px;
  padding: 0.55rem 0.65rem;
}
.readback__meta {
  color: var(--color-muted);
  font-size: 12px;
}
.readback__line {
  display: grid;
  grid-template-columns: 46px 1fr;
  gap: 0.5rem;
  margin-top: 0.35rem;
}
.tag {
  color: var(--color-muted);
  font-size: 12px;
}
.tx__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.seg {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  overflow: hidden;
}
.seg__btn {
  border: none;
  background: transparent;
  color: var(--color-muted);
  padding: 0.35rem 0.6rem;
  cursor: pointer;
}
.seg__btn--on {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text);
}
.tx__actions {
  margin-top: 0.5rem;
  display: flex;
  justify-content: flex-end;
}
.rx {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.14);
  border-radius: 12px;
  overflow: hidden;
}
.rx__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.rx__meta {
  color: var(--color-muted);
  font-size: 12px;
}
.rx__table {
  max-height: 240px;
  overflow: auto;
}
.rx__row {
  display: grid;
  grid-template-columns: 92px 1fr 1fr;
  gap: 0.6rem;
  padding: 0.4rem 0.6rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.rx__row:first-child {
  border-top: none;
}
.rx__ts {
  color: var(--color-muted);
  font-size: 12px;
}
.rx__cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 980px) {
  .row--two {
    grid-template-columns: 1fr;
  }
}
</style>

