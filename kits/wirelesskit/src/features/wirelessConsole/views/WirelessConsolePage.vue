<script setup lang="ts">
import { computed, ref } from "vue";
import { SplitPane, LogConsole } from "@weblink/ui-vue";
import BluetoothPanel from "../components/BluetoothPanel.vue";
import NfcPanel from "../components/NfcPanel.vue";
import { useWirelessConsole } from "../composables/useWirelessConsole";
import { isWebBluetoothSupported, isSecureContextForBluetooth } from "../../../infrastructure/bluetooth/webBluetooth";
import { isWebNfcSupported, isSecureContextForNfc } from "../../../infrastructure/nfc/webNfc";

const rightOpen = ref(true);

const btSupported = computed(() => isWebBluetoothSupported());
const btSecure = computed(() => isSecureContextForBluetooth());
const nfcSupported = computed(() => isWebNfcSupported());
const nfcSecure = computed(() => isSecureContextForNfc());

const { bluetooth, nfc, logs, logLevel, logKeyword, clearLogs } = useWirelessConsole();
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1 class="topbar__title">Wireless Kit</h1>
      <div class="topbar__meta">
        <span v-if="!btSecure || !nfcSecure" class="topbar__warn">需要 HTTPS/localhost</span>
        <span v-else-if="!btSupported" class="topbar__warn">当前浏览器不支持 Web Bluetooth</span>
        <span v-else-if="!nfcSupported" class="topbar__warn">当前浏览器不支持 Web NFC</span>
      </div>
    </header>

    <div class="shell">
      <SplitPane v-model:right-open="rightOpen">
        <template #main>
          <div class="stack">
            <BluetoothPanel :vm="bluetooth" />
            <NfcPanel :vm="nfc" />
          </div>
        </template>

        <template #right>
          <LogConsole
            :logs="logs"
            show-filters
            show-clear
            :level-filter="logLevel"
            :keyword="logKeyword"
            @update:level-filter="logLevel = $event"
            @update:keyword="logKeyword = $event"
            @clear="clearLogs"
          />
        </template>
      </SplitPane>
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: 1440px;
  margin: 0 auto;
  padding: 1.25rem 1rem 2rem;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.topbar__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
}
.topbar__meta {
  display: flex;
  gap: 0.5rem;
}
.topbar__warn {
  font-size: 0.85rem;
  color: rgba(255, 214, 102, 0.95);
}
.shell {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  box-shadow: var(--shadow);
  overflow: hidden;
  height: calc(100vh - 7.25rem);
  min-height: 560px;
}
.stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  height: 100%;
  padding: 0.75rem;
}
</style>

