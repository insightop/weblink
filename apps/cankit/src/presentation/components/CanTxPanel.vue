<script setup lang="ts">
import { ref } from "vue";
import { parseHexBytes } from "@/shared/format.js";

const props = defineProps<{
  connected: boolean;
}>();

const emit = defineEmits<{
  send: [payload: { id: number; extended: boolean; dlc: number; data: Uint8Array }];
}>();

const idHex = ref("123");
const extended = ref(false);
const dataHex = ref("");
const txError = ref<string | null>(null);

function parseId(s: string): number {
  const t = s.trim().replace(/^0x/i, "");
  const n = Number.parseInt(t, 16);
  if (!Number.isFinite(n)) throw new Error("ID 无效");
  return n;
}

function onSend(): void {
  if (!props.connected) return;
  txError.value = null;
  try {
    const id = parseId(idHex.value);
    const data = parseHexBytes(dataHex.value || "");
    const maxId = extended.value ? 0x1fffffff : 0x7ff;
    if (id < 0 || id > maxId) {
      throw new Error(extended.value ? "扩展 ID 越界" : "标准 ID 越界（≤0x7FF）");
    }
    if (data.length > 8) throw new Error("数据最长 8 字节");
    emit("send", { id, extended: extended.value, dlc: data.length, data });
  } catch (e) {
    txError.value = e instanceof Error ? e.message : String(e);
  }
}
</script>

<template>
  <div class="panel">
    <h2 style="margin: 0 0 10px; font-size: 16px">发送（slcan t / T）</h2>
    <div class="toolbar" style="align-items: flex-start">
      <div class="field" style="flex-direction: column; align-items: flex-start">
        <label for="tid">ID（十六进制，不含 0x）</label>
        <input id="tid" v-model="idHex" class="mono" :disabled="!connected">
      </div>
      <label class="field">
        <input v-model="extended" type="checkbox" :disabled="!connected">
        扩展帧
      </label>
      <div class="field" style="flex: 1; min-width: 200px; flex-direction: column; align-items: stretch">
        <label for="data">数据（十六进制字节，可空格分隔）</label>
        <input id="data" v-model="dataHex" class="mono" :disabled="!connected" placeholder="如 01 02 或 0102">
      </div>
      <button type="button" class="btn btn-primary" :disabled="!connected" @click="onSend">
        发送
      </button>
    </div>
    <p v-if="txError" style="color: var(--danger); margin: 8px 0 0; font-size: 13px">{{ txError }}</p>
  </div>
</template>
