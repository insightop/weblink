<script setup lang="ts">
import { computed, ref } from "vue";
import { SplitPane, LogConsole } from "@weblink/ui-vue";
import ConnectionPanel from "../components/ConnectionPanel.vue";
import PeerGrid from "../components/PeerGrid.vue";
import MeshStatsPanel from "../components/MeshStatsPanel.vue";
import { useRtcLab } from "../composables/useRtcLab";

const rightOpen = ref(true);

const {
  roomId,
  localPeerId,
  connected,
  logLevel,
  logKeyword,
  logs,
  iceServersText,
  useCamera,
  useMic,
  sharingScreen,
  previewStream,
  remoteStreams,
  peerStats,
  connect,
  disconnect,
  regeneratePeerId,
  newRoomId,
  toggleScreenShare,
  clearLogs,
} = useRtcLab();

const secure = computed(
  () => typeof window !== "undefined" && window.isSecureContext,
);
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1 class="topbar__title">WebRTC Kit</h1>
      <div class="topbar__meta">
        <span v-if="!secure" class="topbar__warn">需要 HTTPS 或 localhost 以使用媒体设备</span>
        <span v-else-if="connected" class="topbar__ok">信令已连接</span>
      </div>
    </header>

    <div class="shell">
      <SplitPane v-model:right-open="rightOpen">
        <template #main>
          <div class="stack">
            <ConnectionPanel
              v-model:room-id="roomId"
              v-model:ice-servers-text="iceServersText"
              v-model:use-camera="useCamera"
              v-model:use-mic="useMic"
              :local-peer-id="localPeerId"
              :connected="connected"
              :sharing-screen="sharingScreen"
              @connect="connect"
              @disconnect="disconnect"
              @regenerate-peer-id="regeneratePeerId"
              @new-room-id="newRoomId"
              @toggle-screen="toggleScreenShare"
            />
            <PeerGrid
              :local-label="localPeerId.slice(0, 8) + '…'"
              :preview-stream="previewStream"
              :remote-streams="remoteStreams"
            />
            <MeshStatsPanel :peer-stats="peerStats" />
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
.topbar__ok {
  font-size: 0.85rem;
  color: rgba(120, 220, 160, 0.95);
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
  overflow: auto;
}
</style>
