<script setup lang="ts">
import { computed, ref } from "vue";
import SplitPane from "@/shared/ui/SplitPane.vue";
import LogDrawer from "@/features/serialConsole/components/LogDrawer.vue";
import ConnectionPanel from "@/features/serialConsole/components/ConnectionPanel.vue";
import RxPanel from "@/features/serialConsole/components/RxPanel.vue";
import TxPanel from "@/features/serialConsole/components/TxPanel.vue";
import { isWebSerialSupported, isSecureContextForSerial } from "@/infrastructure/serial/webSerial";
import { useSerialConsole } from "@/features/serialConsole/composables/useSerialConsole";

const rightOpen = ref(true);

const supported = computed(() => isWebSerialSupported());
const secure = computed(() => isSecureContextForSerial());

const {
  state,
  lastError,
  baudRate,
  dataBits,
  stopBits,
  parity,
  flowControl,
  selectPort,
  disconnect,
  rxVm,
  clearRx,
  txMode,
  txText,
  txHex,
  txLineEnding,
  lastTxTs,
  canSend,
  send,
  logs,
  logLevel,
  logKeyword,
  clearLogs,
} = useSerialConsole();
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1 class="topbar__title">Serial Kit</h1>
      <div class="topbar__meta">
        <span v-if="!secure" class="topbar__warn">需要 HTTPS/localhost</span>
        <span v-else-if="!supported" class="topbar__warn">当前浏览器不支持 WebSerial</span>
      </div>
    </header>

    <div class="shell">
      <SplitPane v-model:right-open="rightOpen">
        <template #main>
          <div class="stack">
            <ConnectionPanel
              :state="state"
              :last-error="lastError"
              :baud-rate="baudRate"
              :data-bits="dataBits"
              :stop-bits="stopBits"
              :parity="parity"
              :flow-control="flowControl"
              @update:baud-rate="baudRate = $event"
              @update:data-bits="dataBits = $event"
              @update:stop-bits="stopBits = $event"
              @update:parity="parity = $event"
              @update:flow-control="flowControl = $event"
              @select-port="selectPort"
              @disconnect="disconnect"
            />

            <RxPanel
              :lines="rxVm"
              @clear="clearRx"
            />

            <TxPanel
              :mode="txMode"
              :text="txText"
              :hex="txHex"
              :line-ending="txLineEnding"
              :can-send="canSend"
              :last-tx-ts="lastTxTs"
              @update:mode="txMode = $event"
              @update:text="txText = $event"
              @update:hex="txHex = $event"
              @update:line-ending="txLineEnding = $event"
              @send="send"
            />
          </div>
        </template>

        <template #right>
          <LogDrawer
            :logs="logs"
            :level="logLevel"
            :keyword="logKeyword"
            @update:level="logLevel = $event"
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
}
</style>
