<script setup lang="ts">
import { computed, ref } from "vue";
import DeviceCard from "@/features/capturekit/components/DeviceCard.vue";
import { useCameraStream } from "@/features/capturekit/composables/useCameraStream";
import { formatDeviceLabel } from "@/domain/media/deviceLabels";
import { mapMediaError } from "@/domain/media/errors";
import { primeVideoPermission } from "@/infrastructure/media/mediaDevicesFacade";

const props = defineProps<{
  devices: MediaDeviceInfo[];
  refreshDevices: () => Promise<void>;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const selectedId = ref("");
const primeError = ref<string | null>(null);
let selectOpenBusy = false;

const videoInputs = computed(() => props.devices.filter((d) => d.kind === "videoinput"));

const needsVideoPrime = computed(() => {
  const list = videoInputs.value;
  if (list.length === 0) return true;
  return list.every((d) => !d.label?.trim());
});

const canStart = computed(() => videoInputs.value.length > 0 && selectedId.value !== "");

const { error, running, start, stop } = useCameraStream(videoRef);

async function onSelectOpen(): Promise<void> {
  if (selectOpenBusy) return;
  selectOpenBusy = true;
  primeError.value = null;
  try {
    if (needsVideoPrime.value) {
      await primeVideoPermission();
    }
    await props.refreshDevices();
  } catch (e) {
    primeError.value = mapMediaError(e);
  } finally {
    selectOpenBusy = false;
  }
}

async function onToggle(): Promise<void> {
  if (running.value) {
    await stop();
  } else {
    await start(selectedId.value || undefined);
  }
}
</script>

<template>
  <DeviceCard title="相机">
    <template #toolbar>
      <select
        v-model="selectedId"
        class="device-card__select"
        :disabled="running"
        @pointerdown="onSelectOpen"
        @focus="onSelectOpen"
      >
        <option disabled value="">选择设备</option>
        <option v-for="(d, i) in videoInputs" :key="d.deviceId" :value="d.deviceId">
          {{ formatDeviceLabel(d, i) }}
        </option>
      </select>
      <button
        type="button"
        class="device-card__btn"
        :class="{ 'device-card__btn--active': running }"
        :disabled="!running && !canStart"
        @click="onToggle"
      >
        {{ running ? "停止预览" : "开始预览" }}
      </button>
    </template>

    <template v-if="primeError || error" #errors>
      <p v-if="primeError" class="device-card__error">{{ primeError }}</p>
      <p v-if="error" class="device-card__error">{{ error }}</p>
    </template>

    <template #main>
      <div class="video-wrap">
        <video
          ref="videoRef"
          class="video"
          playsinline
          muted
          autoplay
          :class="{ 'video--empty': !running }"
        />
      </div>
    </template>
  </DeviceCard>
</template>

<style scoped>
.video-wrap {
  border-radius: 8px;
  overflow: hidden;
  background: #000;
  aspect-ratio: 16 / 9;
  max-height: 280px;
  width: 100%;
}
.video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  vertical-align: middle;
}
.video--empty {
  opacity: 0.35;
}
</style>
