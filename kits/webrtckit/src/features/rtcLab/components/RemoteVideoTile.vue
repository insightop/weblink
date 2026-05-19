<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";

const props = defineProps<{
  stream: MediaStream;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);

watch(
  () => props.stream,
  (s) => {
    const el = videoRef.value;
    if (!el) return;
    el.srcObject = s;
    void el.play().catch(() => undefined);
  },
  { immediate: true },
);

onUnmounted(() => {
  const el = videoRef.value;
  if (el) el.srcObject = null;
});
</script>

<template>
  <video ref="videoRef" class="vid" playsinline autoplay />
</template>

<style scoped>
.vid {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  background: #000;
}
</style>
