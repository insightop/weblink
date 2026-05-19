<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { NButton, NIcon } from "naive-ui";
import {
  CheckmarkCircleOutline,
  CloseCircleOutline,
  CloudDownloadOutline,
  DownloadOutline,
  SyncOutline,
} from "@vicons/ionicons5";
import { LucideBroomIcon } from "@/shared/icons/lucideBroomIcon";
import FunctionZone from "@/features/flasher/components/FunctionZone.vue";
import type { Component } from "vue";
import type { DownloadResult, RuntimePhase } from "@/features/flasher/stores/flasher.store";

const props = defineProps<{
  canStart: boolean;
  downloadResult: DownloadResult;
  runtimePhase: RuntimePhase;
  progressPercent: number;
  bytesPerSecond: number;
  etaSeconds: number | null;
  successCount: number;
  failedCount: number;
}>();
const emit = defineEmits<{ download: []; clearStats: [] }>();

const { t } = useI18n();
const isHovering = ref(false);

const onPointerEnter = (): void => {
  isHovering.value = true;
};
const onPointerLeave = (): void => {
  isHovering.value = false;
};

const isIdle = computed(() => props.downloadResult === "idle");
const isDownloading = computed(() => props.downloadResult === "running");
const isVerifying = computed(() => props.downloadResult === "running" && props.runtimePhase === "verifying");
const isResult = computed(
  () => props.downloadResult === "success" || props.downloadResult === "error",
);
const isResultHovering = computed(() => isResult.value && isHovering.value);

const formatSpeed = (bytesPerSecond: number): string => {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "--";
  if (bytesPerSecond >= 1024 * 1024) return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
  if (bytesPerSecond >= 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${bytesPerSecond.toFixed(0)} B/s`;
};

const formatEta = (etaSeconds: number | null): string => {
  if (etaSeconds === null || etaSeconds < 0) return "--";
  const minutes = Math.floor(etaSeconds / 60);
  const seconds = etaSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

const buttonText = computed(() => {
  if (isIdle.value) return t("download.idle");
  if (isDownloading.value) {
    if (isVerifying.value) return t("download.verifying");
    return `${formatSpeed(props.bytesPerSecond)} | ${formatEta(props.etaSeconds)}`;
  }
  if (props.downloadResult === "success") {
    return isResultHovering.value ? t("download.again") : t("download.completed");
  }
  if (props.downloadResult === "error") {
    return isResultHovering.value ? t("download.again") : t("download.failed");
  }
  return t("download.idle");
});

const displayIcon = computed<Component>(() => {
  if (isIdle.value) return DownloadOutline;
  if (isDownloading.value) return SyncOutline;
  if (props.downloadResult === "success") {
    return isResultHovering.value ? DownloadOutline : CheckmarkCircleOutline;
  }
  if (props.downloadResult === "error") {
    return isResultHovering.value ? DownloadOutline : CloseCircleOutline;
  }
  return DownloadOutline;
});

const buttonType = computed<"primary" | "success" | "error" | "warning" | "info">(() => {
  if (isVerifying.value) return "info";
  if (isDownloading.value) return "warning";
  if (isResultHovering.value) return "primary";
  if (props.downloadResult === "success") return "success";
  if (props.downloadResult === "error") return "error";
  return "primary";
});

const buttonDisabled = computed(() => props.downloadResult === "running" || !props.canStart);

const progressWidth = computed(() => `${Math.min(100, Math.max(0, props.progressPercent))}%`);
</script>

<template>
  <FunctionZone
    :title="t('zones.download')"
    :title-icon="CloudDownloadOutline"
    help-key="download"
  >
    <template #subtitleExtra>
      <span class="stats-subtitle">
        <span class="stats-prefix">{{ t("download.counterLabel") }}</span>
        <NIcon
          :component="CheckmarkCircleOutline"
          :size="14"
          class="stats-icon success"
        />
        <span class="stats-number">{{ props.successCount }}</span>
        <NIcon
          :component="CloseCircleOutline"
          :size="14"
          class="stats-icon failed"
        />
        <span class="stats-number">{{ props.failedCount }}</span>
        <NButton
          text
          size="tiny"
          class="clear-stats-btn"
          :aria-label="t('download.clearStats')"
          @click="emit('clearStats')"
        >
          <template #icon>
            <NIcon
              :component="LucideBroomIcon"
              :size="16"
            />
          </template>
        </NButton>
      </span>
    </template>
    <span
      class="btn-wrap"
      @mouseenter="onPointerEnter"
      @mouseleave="onPointerLeave"
    >
      <NButton
        class="download"
        :class="{ 'download--running': isDownloading, 'download--verifying': isVerifying }"
        :type="buttonType"
        :disabled="buttonDisabled"
        @click="emit('download')"
      >
        <span
          v-if="isDownloading"
          class="progress-fill"
          :class="isVerifying ? 'progress-fill--verifying' : 'progress-fill--running'"
          :style="{ width: progressWidth }"
        />
        <span class="content">
          <NIcon
            :component="displayIcon"
            :size="20"
            :class="{ spin: isDownloading }"
          />
          <span class="text">{{ buttonText }}</span>
        </span>
      </NButton>
    </span>
  </FunctionZone>
</template>

<style scoped>
.btn-wrap {
  width: 100%;
  display: block;
}
.download {
  height: 42px;
  font-weight: 600;
  width: 100%;
  position: relative;
  overflow: hidden;
}
.progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: color-mix(in srgb, var(--brand-300) 70%, transparent);
  transition: width 0.2s linear;
  z-index: 0;
}
.progress-fill--running {
  /* 标准琥珀色前景，仅通过透明度与底色区分 */
  background: color-mix(in srgb, var(--warning-500) 94%, transparent);
}
.progress-fill--verifying {
  background: color-mix(in srgb, var(--info-500) 94%, transparent);
}
/* 下载 / 校验中禁用仍保持明亮，覆盖 Naive disabled 透明度 */
.download.download--running.n-button.n-button--disabled,
.download.download--verifying.n-button.n-button--disabled {
  opacity: 1 !important;
}
.download.download--running.n-button.n-button--disabled :deep(.n-button__content),
.download.download--running.n-button.n-button--disabled :deep(.n-button__border),
.download.download--running.n-button.n-button--disabled :deep(.n-button__state-border),
.download.download--verifying.n-button.n-button--disabled :deep(.n-button__content),
.download.download--verifying.n-button.n-button--disabled :deep(.n-button__border),
.download.download--verifying.n-button.n-button--disabled :deep(.n-button__state-border) {
  opacity: 1 !important;
}
.download.download--running {
  /* 标准琥珀色背景，透明度更高（更淡） */
  --n-color: color-mix(in srgb, var(--warning-500) 18%, transparent) !important;
  --n-color-hover: color-mix(in srgb, var(--warning-500) 22%, transparent) !important;
  --n-color-pressed: color-mix(in srgb, var(--warning-500) 26%, transparent) !important;
  --n-color-focus: color-mix(in srgb, var(--warning-500) 18%, transparent) !important;
}
.download.download--verifying {
  --n-color: color-mix(in srgb, var(--info-500) 18%, transparent) !important;
  --n-color-hover: color-mix(in srgb, var(--info-500) 22%, transparent) !important;
  --n-color-pressed: color-mix(in srgb, var(--info-500) 26%, transparent) !important;
  --n-color-focus: color-mix(in srgb, var(--info-500) 18%, transparent) !important;
}
.content {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
}
.text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.spin {
  animation: spin 0.9s linear infinite;
}
.clear-stats-btn {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: 2px;
}
.stats-subtitle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.stats-prefix {
  font-size: 11px;
  color: var(--text-secondary);
}
.stats-icon.success {
  color: var(--success-500);
}
.stats-icon.failed {
  color: var(--error-500);
}
.stats-number {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
