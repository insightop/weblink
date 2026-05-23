<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { TransportMode } from "../../application/composables/useCanSession.js";

const props = defineProps<{
  transportMode: TransportMode;
  serialSupported: boolean;
  usbSupported: boolean;
  connected: boolean;
  connecting: boolean;
  hasPort: boolean;
  hasUsb: boolean;
  errorMessage: string | null;
}>();

const emit = defineEmits<{
  "update:transportMode": [mode: TransportMode];
  pickPort: [];
  pickUsb: [];
  connect: [payload: { baudRate: number; canBitrate: number | null }];
  disconnect: [];
}>();

function setMode(m: TransportMode): void {
  if (props.connected) return;
  emit("update:transportMode", m);
}

const baudRate = ref(921600);

const baudOptions = [
  9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600, 1000000, 2000000,
];

const canBitrateKey = ref<"none" | "125000" | "250000" | "500000" | "1000000">(
  "500000",
);

watch(
  () => props.transportMode,
  (m) => {
    if (m === "gs_usb" && canBitrateKey.value === "none") {
      canBitrateKey.value = "500000";
    }
  },
);

const canConnect = computed(() => {
  if (props.connected || props.connecting) return false;
  const map: Record<typeof canBitrateKey.value, number | null> = {
    none: null,
    "125000": 125000,
    "250000": 250000,
    "500000": 500000,
    "1000000": 1000000,
  };
  const br = map[canBitrateKey.value];
  if (props.transportMode === "slcan") {
    return props.serialSupported && props.hasPort;
  }
  return props.usbSupported && props.hasUsb && br != null;
});

function onConnect(): void {
  const map: Record<typeof canBitrateKey.value, number | null> = {
    none: null,
    "125000": 125000,
    "250000": 250000,
    "500000": 500000,
    "1000000": 1000000,
  };
  emit("connect", {
    baudRate: baudRate.value,
    canBitrate: map[canBitrateKey.value],
  });
}

</script>

<template>
  <div class="panel">
    <div class="toolbar" style="margin-bottom: 8px">
      <span style="color: var(--muted); font-size: 13px">传输</span>
      <label class="field">
        <input
          type="radio"
          name="tm"
          :checked="transportMode === 'slcan'"
          :disabled="connected"
          @change="setMode('slcan')"
        >
        slcan（Web Serial）
      </label>
      <label class="field">
        <input
          type="radio"
          name="tm"
          :checked="transportMode === 'gs_usb'"
          :disabled="connected"
          @change="setMode('gs_usb')"
        >
        gs_usb（WebUSB）
      </label>
    </div>

    <div class="toolbar">
      <template v-if="transportMode === 'slcan'">
        <button
          type="button"
          class="btn"
          :disabled="!serialSupported || connected"
          @click="emit('pickPort')"
        >
          选择串口
        </button>
        <div class="field">
          <label for="baud">串口波特率</label>
          <select id="baud" v-model.number="baudRate" :disabled="connected">
            <option v-for="b in baudOptions" :key="b" :value="b">{{ b }}</option>
          </select>
        </div>
        <div class="field">
          <label for="canb">CAN 比特率</label>
          <select id="canb" v-model="canBitrateKey" :disabled="connected">
            <option value="none">不发送 S（适配器已设）</option>
            <option value="125000">125 kbit/s (S4)</option>
            <option value="250000">250 kbit/s (S5)</option>
            <option value="500000">500 kbit/s (S6)</option>
            <option value="1000000">1 Mbit/s (S8)</option>
          </select>
        </div>
      </template>

      <template v-else>
        <button
          type="button"
          class="btn"
          :disabled="!usbSupported || connected"
          @click="emit('pickUsb')"
        >
          选择 USB（gs_usb）
        </button>
        <div class="field">
          <label for="canb2">CAN 比特率</label>
          <select id="canb2" v-model="canBitrateKey" :disabled="connected">
            <option value="125000">125 kbit/s</option>
            <option value="250000">250 kbit/s</option>
            <option value="500000">500 kbit/s</option>
            <option value="1000000">1 Mbit/s</option>
          </select>
        </div>
      </template>

      <button
        type="button"
        class="btn btn-primary"
        :disabled="!canConnect"
        @click="onConnect"
      >
        连接
      </button>
      <button
        type="button"
        class="btn btn-danger"
        :disabled="!connected || connecting"
        @click="emit('disconnect')"
      >
        断开
      </button>
    </div>
    <p
      v-if="errorMessage"
      style="color: var(--danger); margin: 8px 0 0; font-size: 13px"
    >
      {{ errorMessage }}
    </p>
  </div>
</template>
