<script setup lang="ts">
import { computed, watch, ref, onUnmounted } from "vue";
import RemoteVideoTile from "@/features/rtcLab/components/RemoteVideoTile.vue";

const props = defineProps<{
  localLabel: string;
  previewStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
}>();

const localVideo = ref<HTMLVideoElement | null>(null);

const remoteList = computed(() => [...props.remoteStreams.entries()]);

watch(
  () => props.previewStream,
  (s) => {
    const el = localVideo.value;
    if (!el) return;
    el.srcObject = s;
    if (s) void el.play().catch(() => undefined);
  },
  { immediate: true },
);

onUnmounted(() => {
  const el = localVideo.value;
  if (el) el.srcObject = null;
});
</script>

<template>
  <section class="panel">
    <h2 class="panel__title">视频</h2>
    <div class="grid">
      <div class="tile">
        <div class="tile__label">{{ localLabel }}（本机）</div>
        <video ref="localVideo" class="vid" playsinline autoplay muted />
      </div>
      <div v-for="[peerId, stream] in remoteList" :key="peerId" class="tile">
        <div class="tile__label">远端 {{ peerId.slice(0, 8) }}…</div>
        <RemoteVideoTile :stream="stream" />
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
  margin: 0 0 0.5rem;
  font-size: 1rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.65rem;
}
.tile {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.2);
}
.tile__label {
  padding: 0.35rem 0.5rem;
  font-size: 0.78rem;
  color: var(--color-muted);
  border-bottom: 1px solid var(--color-border);
}
.vid {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  background: #000;
}
</style>
