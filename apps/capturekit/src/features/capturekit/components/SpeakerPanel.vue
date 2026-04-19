<script setup lang="ts">
import { computed, ref } from "vue";
import DeviceCard from "@/features/capturekit/components/DeviceCard.vue";
import {
  playTestTone,
  supportsSetSinkId,
  useAudioOutputDevices,
} from "@/features/capturekit/composables/useAudioOutput";
import { formatDeviceLabel } from "@/domain/media/deviceLabels";
import { mapMediaError } from "@/domain/media/errors";

const props = defineProps<{
  devices: MediaDeviceInfo[];
  refreshDevices: () => Promise<void>;
}>();

/** 主功能区内可选的测试音（频率 Hz） */
const TEST_TONES = [
  { id: "t100", label: "100 Hz（低频）", frequencyHz: 100 },
  { id: "t440", label: "440 Hz", frequencyHz: 440 },
  { id: "t1k", label: "1 kHz", frequencyHz: 1000 },
  { id: "t2k5", label: "2.5 kHz", frequencyHz: 2500 },
  { id: "t6k", label: "6 kHz（高频）", frequencyHz: 6000 },
] as const;

const { outputDevices } = useAudioOutputDevices(
  computed(() => props.devices),
);

const selectedSinkId = ref("");
const selectedToneId = ref<(typeof TEST_TONES)[number]["id"]>(TEST_TONES[0].id);
const playing = ref(false);
const error = ref<string | null>(null);

let selectOpenBusy = false;

const sinkSupported = computed(() => supportsSetSinkId());

const selectedFrequencyHz = computed(() => {
  const t = TEST_TONES.find((x) => x.id === selectedToneId.value);
  return t?.frequencyHz ?? TEST_TONES[0].frequencyHz;
});

async function onSelectOpen(): Promise<void> {
  if (selectOpenBusy) return;
  selectOpenBusy = true;
  try {
    await props.refreshDevices();
  } finally {
    selectOpenBusy = false;
  }
}

async function onPlayTest(): Promise<void> {
  error.value = null;
  playing.value = true;
  try {
    await playTestTone(
      selectedSinkId.value || undefined,
      450,
      selectedFrequencyHz.value,
    );
  } catch (e) {
    error.value = mapMediaError(e);
  } finally {
    playing.value = false;
  }
}
</script>

<template>
  <DeviceCard title="扬声器">
    <template #toolbar>
      <select
        v-model="selectedSinkId"
        class="device-card__select"
        @pointerdown="onSelectOpen"
        @focus="onSelectOpen"
      >
        <option value="">默认输出</option>
        <option v-for="(d, i) in outputDevices" :key="d.deviceId" :value="d.deviceId">
          {{ formatDeviceLabel(d, i) }}
        </option>
      </select>
      <button
        type="button"
        class="device-card__btn"
        :disabled="playing"
        @click="onPlayTest"
      >
        {{ playing ? "播放中…" : "开始播放" }}
      </button>
    </template>

    <template v-if="!sinkSupported || error" #errors>
      <p v-if="!sinkSupported" class="device-card__warn">
        当前浏览器未暴露 setSinkId，测试音将从默认输出播放。
      </p>
      <p v-if="error" class="device-card__error">{{ error }}</p>
    </template>

    <template #main>
      <fieldset class="tone-group">
        <legend id="speaker-tone-legend" class="tone-group__legend">测试音</legend>
        <div class="tone-group__radios" role="radiogroup" aria-labelledby="speaker-tone-legend">
          <label
            v-for="t in TEST_TONES"
            :key="t.id"
            class="tone-option"
            :class="{ 'tone-option--checked': selectedToneId === t.id }"
          >
            <input
              v-model="selectedToneId"
              class="tone-option__input"
              type="radio"
              name="speaker-test-tone"
              :value="t.id"
              :disabled="playing"
            >
            <span class="tone-option__label">{{ t.label }}</span>
          </label>
        </div>
      </fieldset>
    </template>
  </DeviceCard>
</template>

<style scoped>
.tone-group {
  margin: 0;
  padding: 0.75rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  min-height: 5rem;
}
.tone-group__legend {
  padding: 0 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-muted);
}
.tone-group__radios {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.35rem;
}
.tone-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.88rem;
  line-height: 1.35;
  padding: 0.2rem 0.15rem;
  border-radius: 6px;
  transition: background 0.12s ease;
}
.tone-option:hover:not(:has(.tone-option__input:disabled)) {
  background: rgba(127, 127, 127, 0.08);
}
.tone-option--checked {
  background: rgba(88, 166, 255, 0.1);
}
.tone-option__input {
  margin: 0;
  flex-shrink: 0;
  accent-color: var(--color-accent, #58a6ff);
}
.tone-option__label {
  color: var(--color-text);
  user-select: none;
}
.tone-option:has(.tone-option__input:disabled) {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
