<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  roomId: string;
  localPeerId: string;
  connected: boolean;
  iceServersText: string;
  useCamera: boolean;
  useMic: boolean;
  sharingScreen: boolean;
}>();

const emit = defineEmits<{
  (e: "update:roomId", v: string): void;
  (e: "update:iceServersText", v: string): void;
  (e: "update:useCamera", v: boolean): void;
  (e: "update:useMic", v: boolean): void;
  (e: "connect"): void;
  (e: "disconnect"): void;
  (e: "regeneratePeerId"): void;
  (e: "newRoomId"): void;
  (e: "toggleScreen"): void;
}>();

const canConnect = computed(() => !props.connected && props.roomId.trim().length > 0);
</script>

<template>
  <section class="panel">
    <h2 class="panel__title">连接</h2>
    <p class="panel__hint">
      需要 HTTPS 或 localhost。全网格 mesh 建议在 4～6 人以内调试音视频；更多节点请优先用 DataChannel。
    </p>

    <div class="grid">
      <label class="field">
        <span class="label">房间 ID</span>
        <div class="row">
          <input
            class="inp"
            :value="props.roomId"
            :disabled="props.connected"
            autocomplete="off"
            @input="emit('update:roomId', ($event.target as HTMLInputElement).value)"
          >
          <button type="button" class="btn" :disabled="props.connected" @click="emit('newRoomId')">
            随机
          </button>
        </div>
      </label>

      <label class="field">
        <span class="label">本机 Peer ID</span>
        <div class="row">
          <code class="code">{{ props.localPeerId }}</code>
          <button
            type="button"
            class="btn"
            :disabled="props.connected"
            @click="emit('regeneratePeerId')"
          >
            重新生成
          </button>
        </div>
      </label>

      <label class="field field--full">
        <span class="label">ICE 服务器（空则默认 STUN；或 JSON 数组 / 每行一个 URL）</span>
        <textarea
          class="textarea"
          rows="3"
          :disabled="props.connected"
          :value="props.iceServersText"
          @input="emit('update:iceServersText', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>

      <div class="field field--full toggles">
        <label class="chk">
          <input
            type="checkbox"
            :checked="props.useCamera"
            :disabled="props.connected"
            @change="
              emit('update:useCamera', ($event.target as HTMLInputElement).checked)
            "
          >
          摄像头
        </label>
        <label class="chk">
          <input
            type="checkbox"
            :checked="props.useMic"
            :disabled="props.connected"
            @change="emit('update:useMic', ($event.target as HTMLInputElement).checked)"
          >
          麦克风
        </label>
      </div>

      <div class="field field--full actions">
        <button
          type="button"
          class="btn btn--primary"
          :disabled="!canConnect"
          @click="emit('connect')"
        >
          进入房间
        </button>
        <button type="button" class="btn" :disabled="!props.connected" @click="emit('disconnect')">
          断开
        </button>
        <button type="button" class="btn" :disabled="!props.connected" @click="emit('toggleScreen')">
          {{ props.sharingScreen ? "停止共享屏幕" : "共享屏幕" }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
}
.panel__title {
  margin: 0 0 0.35rem;
  font-size: 1rem;
}
.panel__hint {
  margin: 0 0 0.65rem;
  font-size: 0.82rem;
  color: var(--color-muted);
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.field--full {
  grid-column: 1 / -1;
}
.label {
  font-size: 0.82rem;
  color: var(--color-muted);
}
.row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
}
.inp {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text);
  border-radius: 10px;
  padding: 0.45rem 0.55rem;
}
.textarea {
  width: 100%;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text);
  border-radius: 10px;
  padding: 0.45rem 0.55rem;
  resize: vertical;
}
.code {
  flex: 1;
  min-width: 0;
  overflow: auto;
  font-size: 0.78rem;
  padding: 0.35rem 0.45rem;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--color-border);
}
.btn {
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text);
  border-radius: 10px;
  padding: 0.4rem 0.65rem;
  cursor: pointer;
  white-space: nowrap;
}
.btn--primary {
  border-color: rgba(110, 168, 254, 0.55);
  background: rgba(110, 168, 254, 0.18);
}
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.toggles {
  flex-direction: row;
  gap: 1rem;
}
.chk {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  font-size: 0.9rem;
}
.actions {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.5rem;
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
