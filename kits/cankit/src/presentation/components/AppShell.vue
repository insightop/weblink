<script setup lang="ts">
import { useCanSession } from "../../application/composables/useCanSession.js";
import ConnectionToolbar from "./ConnectionToolbar.vue";
import CanTxPanel from "./CanTxPanel.vue";
import CanRxTable from "./CanRxTable.vue";

const {
  serialSupported,
  usbSupported,
  transportMode,
  connected,
  connecting,
  errorMessage,
  rxRows,
  logLines,
  selectedPort,
  selectedUsb,
  pickPort,
  pickUsbDevice,
  connect,
  disconnect,
  clearRx,
  clearLogs,
  sendFrame,
} = useCanSession();

async function onConnect(payload: {
  baudRate: number;
  canBitrate: number | null;
}): Promise<void> {
  await connect({
    baudRate: payload.baudRate,
    canBitrate: payload.canBitrate,
  });
}

async function onSend(p: {
  id: number;
  extended: boolean;
  dlc: number;
  data: Uint8Array;
}): Promise<void> {
  try {
    await sendFrame(p);
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e);
  }
}
</script>

<template>
  <div style="min-height: 100%; padding: 16px; max-width: 1200px; margin: 0 auto">
    <header style="margin-bottom: 16px">
      <h1 style="margin: 0 0 6px; font-size: 22px">weblink-cankit</h1>
      <p style="margin: 0; color: var(--muted); font-size: 14px">
        slcan（Web Serial）与 gs_usb（WebUSB）· Chromium + HTTPS 或 localhost
      </p>
    </header>

    <div v-if="!serialSupported && !usbSupported" class="banner">
      当前浏览器不支持 Web Serial / WebUSB。请使用 Chrome / Edge / Brave 等，并确保通过
      HTTPS 或 localhost 访问。
    </div>
    <div v-else-if="transportMode === 'slcan' && !serialSupported" class="banner">
      当前浏览器不支持 Web Serial，请改用支持 Web Serial 的 Chromium 内核浏览器。
    </div>
    <div v-else-if="transportMode === 'gs_usb' && !usbSupported" class="banner">
      当前浏览器不支持 WebUSB，请改用支持 WebUSB 的 Chromium 内核浏览器。
    </div>

    <ConnectionToolbar
      v-model:transport-mode="transportMode"
      :serial-supported="serialSupported"
      :usb-supported="usbSupported"
      :connected="connected"
      :connecting="connecting"
      :has-port="!!selectedPort"
      :has-usb="!!selectedUsb"
      :error-message="errorMessage"
      @pick-port="() => void pickPort()"
      @pick-usb="() => void pickUsbDevice()"
      @connect="onConnect"
      @disconnect="() => void disconnect()"
    />

    <div style="height: 12px" />

    <CanTxPanel :connected="connected" @send="onSend" />

    <div style="height: 12px" />

    <CanRxTable :rows="rxRows" @clear="clearRx" />

    <div style="height: 12px" />

    <div class="panel">
      <div class="toolbar" style="justify-content: space-between">
        <h2 style="margin: 0; font-size: 16px">日志</h2>
        <button type="button" class="btn" @click="clearLogs">清空</button>
      </div>
      <pre
        class="mono"
        style="margin: 8px 0 0; font-size: 12px; color: var(--muted); white-space: pre-wrap; max-height: 160px; overflow: auto"
      >{{ logLines.join("\n") }}</pre>
    </div>
  </div>
</template>
