<script setup lang="ts">
import { computed, ref } from "vue";
import DeviceCard from "./DeviceCard.vue";
import MicWaveformCanvas from "./MicWaveformCanvas.vue";
import { useMicLevelMeter } from "../composables/useMicLevelMeter";
import { formatDeviceLabel } from "../../../domain/media/deviceLabels";
import { mapMediaError } from "../../../domain/media/errors";
import { primeAudioPermission } from "../../../infrastructure/media/mediaDevicesFacade";

const props = defineProps<{
  devices: MediaDeviceInfo[];
  refreshDevices: () => Promise<void>;
}>();

const selectedId = ref("");
const primeError = ref<string | null>(null);
let selectOpenBusy = false;
const audioInputs = computed(() => props.devices.filter((d) => d.kind === "audioinput"));

const needsAudioPrime = computed(() => {
  const list = audioInputs.value;
  if (list.length === 0) return true;
  return list.every((d) => !d.label?.trim());
});

const canStart = computed(() => audioInputs.value.length > 0 && selectedId.value !== "");

const { level, error, running, waveformData, start, stop } = useMicLevelMeter();

async function onSelectOpen(): Promise<void> {
  if (selectOpenBusy) return;
  selectOpenBusy = true;
  primeError.value = null;
  try {
    if (needsAudioPrime.value) {
      await primeAudioPermission();
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

const levelPct = computed(() => Math.round(level.value * 100));
</script>

<template>
  <DeviceCard title="麦克风">
    <template #toolbar>
      <select
        v-model="selectedId"
        class="device-card__select"
        :disabled="running"
        @pointerdown="onSelectOpen"
        @focus="onSelectOpen"
      >
        <option disabled value="">选择设备</option>
        <option v-for="(d, i) in audioInputs" :key="d.deviceId" :value="d.deviceId">
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
        {{ running ? "停止采集" : "开始采集" }}
      </button>
    </template>

    <template v-if="primeError || error" #errors>
      <p v-if="primeError" class="device-card__error">{{ primeError }}</p>
      <p v-if="error" class="device-card__error">{{ error }}</p>
    </template>

    <template #main>
      <div class="mic-main">
        <MicWaveformCanvas :running="running" :samples="waveformData" />
        <div class="meter" aria-label="麦克风电平">
          <div class="meter__track">
            <div class="meter__fill" :style="{ width: levelPct + '%' }" />
          </div>
          <span class="meter__value">{{ levelPct }}%</span>
        </div>
      </div>
    </template>
  </DeviceCard>
</template>

<style scoped>
.mic-main {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  flex: 1;
}
.meter {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}
.meter__track {
  flex: 1;
  height: 12px;
  border-radius: 6px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  overflow: hidden;
}
.meter__fill {
  height: 100%;
  background: linear-gradient(90deg, #238636, #3fb950);
  transition: width 0.05s linear;
}
.meter__value {
  font-size: 0.85rem;
  color: var(--color-muted);
  min-width: 2.5rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
