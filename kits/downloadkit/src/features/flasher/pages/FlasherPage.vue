<script setup lang="ts">
import { computed, nextTick, onMounted, ref, unref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { NFloatButton, NIcon } from "naive-ui";
import { DocumentTextOutline } from "@vicons/ionicons5";
import { Pane, Splitpanes } from "splitpanes";
import TargetSelector from "@/features/flasher/components/TargetSelector.vue";
import FlasherSelector from "@/features/flasher/components/FlasherSelector.vue";
import FirmwareInputPanel from "@/features/flasher/components/FirmwareInputPanel.vue";
import type { FirmwareInputPanelExpose } from "@/features/flasher/components/firmwareInputPanelExpose";
import DownloadPanel from "@/features/flasher/components/DownloadPanel.vue";
import LogSidebar from "@/features/flasher/components/LogSidebar.vue";
import TargetVariantDialog from "@/features/flasher/components/TargetVariantDialog.vue";
import LanguageSwitcher from "@/features/flasher/components/LanguageSwitcher.vue";
import { useFlasherStore } from "@/features/flasher/stores/flasher.store";
import {
  getCurrentDeviceDetails,
  getCurrentPluginMeta,
  getFlasherOptionsForTarget,
  getFlasherRuntimeInfo,
  prepareFlasherForCurrentSelection,
  startFlash,
} from "@/features/flasher/services/flasherFacade";
import { flasherLogger } from "@/features/flasher/services/flasherLogger";
import { createStlinkTargetSession, tryAutoPickTarget } from "@/features/flasher/services/stlinkTargetPreference";
import type { StlinkTargetVariant } from "@/transports/adapters/stlink.adapter";
import { i18n } from "@/i18n";
import type { PluginConfigObject } from "@/plugins/config/pluginConfig.types";
import { flasherPersistenceRepository } from "@/features/flasher/persistence/repository";
import type { PersistedFlasherSession } from "@/features/flasher/persistence/schema";
import type { ChipFamily } from "@/plugins/types";

const { t } = useI18n();
const store = useFlasherStore();
const firmwareInput = ref<FirmwareInputPanelExpose | null>(null);
const resolveTargetPicker = ref<((type: string | null) => void) | null>(null);
const flasherOptions = computed(() => getFlasherOptionsForTarget(store.chipFamily));
const logPanelExpanded = ref(true);
const rightPanePercent = ref<number>(28);
const isHydratingPersistence = ref(true);
let persistDebounceTimer: ReturnType<typeof window.setTimeout> | null = null;
const onPaneResized = (event: { size: number }[]): void => {
  if (!logPanelExpanded.value) return;
  const right = event[1];
  if (!right) return;
  rightPanePercent.value = right.size;
};
const expandLogPanel = (): void => {
  logPanelExpanded.value = true;
};
const collapseLogPanel = (): void => {
  logPanelExpanded.value = false;
};

const currentPlugin = computed(() => getCurrentPluginMeta());
const currentPluginConfigSchema = computed(() => currentPlugin.value?.configSchema ?? null);
const currentPluginConfig = computed<PluginConfigObject>(() => {
  const plugin = currentPlugin.value;
  if (!plugin) return {};
  const defaults = plugin.createDefaultConfig?.() ?? {};
  const current = store.getPluginConfig(plugin.id) ?? {};
  return { ...defaults, ...current };
});
const flasherSubtitle = computed(() => {
  if (!store.flasherType) return t("flasherPage.deviceNotSelected");
  if (store.flasherStatus !== "ready") {
    if (store.flasherStatus === "selecting") return t("flasherPage.deviceSelecting");
    if (store.flasherError) return `${t("flasherPage.deviceFailed")}: ${store.flasherError}`;
    return t("flasherPage.deviceNotConnected");
  }
  const details = getCurrentDeviceDetails();
  const label = store.flasherLabel ? [`DEVICE: ${store.flasherLabel}`] : [];
  return `${t("flasherPage.connected")} | ${[...label, ...details].join(" | ")}`;
});



function syncPluginConfigState(): void {
  const plugin = currentPlugin.value;
  if (!plugin || !plugin.createDefaultConfig) return;
  const existing = store.getPluginConfig(plugin.id);
  const normalized = plugin.normalizeConfig?.(existing) ?? { ...plugin.createDefaultConfig(), ...(existing ?? {}) };
  store.initPluginConfig(plugin.id, plugin.createDefaultConfig());
  store.setPluginConfig(plugin.id, normalized);
}

const connectSelectedFlasher = async (forceReselect = false): Promise<void> => {
  if (!store.chipFamily || !store.flasherType) return;
  syncPluginConfigState();
  store.setFlasherRuntime(getFlasherRuntimeInfo());
  try {
    await prepareFlasherForCurrentSelection({ forceReselect });
  } catch (error) {
    flasherLogger.error(error instanceof Error ? error.message : String(error));
  }
};

const onTargetSelected = (target: ChipFamily): void => {
  store.clearStlinkTargetSession();
  store.setChipFamily(target);
  store.setFlasherType(null);
  store.setFlasherState({ status: "idle", label: null, error: null });
  store.setFlasherRuntime(getFlasherRuntimeInfo());
};

const onFlasherSelected = async (flasher: "serial" | "usb-dfu" | "st-link" | "dap-link"): Promise<void> => {
  store.clearStlinkTargetSession();
  store.setFlasherType(flasher);
  await connectSelectedFlasher();
};

function schedulePersistSnapshot(): void {
  if (isHydratingPersistence.value) return;
  if (persistDebounceTimer) window.clearTimeout(persistDebounceTimer);
  persistDebounceTimer = window.setTimeout(() => {
    void persistSnapshot();
  }, 250);
}

async function persistSnapshot(): Promise<void> {
  try {
    // Pinia 响应式对象（Proxy）不能直接写入 IndexedDB，先转成可克隆的纯 JSON 对象。
    const pluginConfigsSafe = JSON.parse(JSON.stringify(store.pluginConfigs)) as PersistedFlasherSession["pluginConfigs"];
    const snapshot: PersistedFlasherSession = {
      version: 2,
      chipFamily: store.chipFamily,
      flasherType: store.flasherType,
      pluginConfigs: pluginConfigsSafe,
      firmwareRows: firmwareInput.value?.exportFirmwareRows() ?? [],
      downloadStats: { ...store.downloadStats },
    };
    await flasherPersistenceRepository.saveLastSession(snapshot);
  } catch (error) {
    // 固件 Blob 持久化失败时降级为“仅配置持久化”，保证刷新后至少能恢复 target/flasher/config。
    try {
      const fallbackSnapshot: PersistedFlasherSession = {
        version: 2,
        chipFamily: store.chipFamily,
        flasherType: store.flasherType,
        pluginConfigs: JSON.parse(JSON.stringify(store.pluginConfigs)) as PersistedFlasherSession["pluginConfigs"],
        firmwareRows: [],
        downloadStats: { ...store.downloadStats },
      };
      await flasherPersistenceRepository.saveLastSession(fallbackSnapshot);
      flasherLogger.warning("Persistence fallback activated: firmware rows were skipped.");
    } catch (fallbackError) {
      flasherLogger.warning(fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
    }
    flasherLogger.warning(error instanceof Error ? error.message : String(error));
  }
}

watch(
  () => store.chipFamily,
  () => {
    store.clearStlinkTargetSession();
    store.setFlasherRuntime(getFlasherRuntimeInfo());
    schedulePersistSnapshot();
  },
);

watch(
  () => store.flasherType,
  () => {
    store.clearStlinkTargetSession();
    store.setFlasherRuntime(getFlasherRuntimeInfo());
    schedulePersistSnapshot();
  },
);

watch(
  () => (firmwareInput.value ? unref(firmwareInput.value.firmwareFingerprint) : null),
  () => {
    store.clearStlinkTargetSession();
    schedulePersistSnapshot();
  },
);
watch(
  () => store.pluginConfigs,
  () => {
    schedulePersistSnapshot();
  },
  { deep: true },
);
watch(
  () => store.downloadStats,
  () => {
    schedulePersistSnapshot();
  },
  { deep: true },
);

watch(
  () => [store.firmwareReady, store.flasherStatus, store.flasherType, store.chipFamily],
  () => {
    if (store.downloadResult !== "running") {
      store.resetDownloadResult();
    }
  },
);

const download = async (): Promise<void> => {
  try {
    if (!store.canStartDownload) {
      flasherLogger.warning(t("flasherPage.downloadBlocked"));
      return;
    }
    if (!store.flasherCanFlash) {
      flasherLogger.warning(t("flasherPage.flashNotImplemented"));
      return;
    }
    const input = await firmwareInput.value?.getInput();
    if (!input) return;
    const finished = await startFlash(input, {
      pickStlinkTarget: async (candidates: StlinkTargetVariant[]) => {
        const auto = tryAutoPickTarget(store.stlinkTargetSession, candidates);
        if (auto) {
          flasherLogger.info(String(i18n.global.t("target.autoPicked", { type: auto })), {
            type: auto,
            candidates: candidates.map((c) => c.type),
          });
          return auto;
        }
        return await new Promise<string | null>((resolve) => {
          resolveTargetPicker.value = resolve;
          store.openTargetPicker(candidates);
        });
      },
    });
    if (finished) {
      flasherLogger.info(t("flasherPage.downloadCompleted"));
    }
  } catch (error) {
    if (store.downloadResult !== "running") {
      store.setDownloadResult("error");
    }
    const maybeDownloadError = error as unknown as { userMessage?: unknown; debugMessage?: unknown };
    if (maybeDownloadError && typeof maybeDownloadError.userMessage === "string") {
      flasherLogger.error(maybeDownloadError.userMessage);
      if (typeof maybeDownloadError.debugMessage === "string") {
        flasherLogger.debug(`Debug: ${maybeDownloadError.debugMessage}`);
      }
      return;
    }
    flasherLogger.error(error instanceof Error ? error.message : String(error));
  }
};


const onPluginConfigFieldUpdate = (key: string, value: string | number | boolean): void => {
  const plugin = currentPlugin.value;
  if (!plugin) return;
  store.updatePluginConfigField(plugin.id, key, value);
  const existing = store.getPluginConfig(plugin.id);
  const normalized = plugin.normalizeConfig?.(existing) ?? existing;
  if (normalized) {
    store.setPluginConfig(plugin.id, normalized);
  }
  void connectSelectedFlasher();
};

const onFlasherReenter = (): void => {
  if (!store.flasherType) return;
  store.clearStlinkTargetSession();
  void connectSelectedFlasher(true);
};

const onTargetConfirm = (payload: { type: string; remember: boolean }): void => {
  if (payload.remember) {
    store.setStlinkTargetSession(createStlinkTargetSession(store.targetCandidates, payload.type));
  }
  store.confirmTargetSelection(payload.type);
  resolveTargetPicker.value?.(payload.type);
  resolveTargetPicker.value = null;
};

const onTargetCancel = (): void => {
  store.cancelTargetSelection();
  resolveTargetPicker.value?.(null);
  resolveTargetPicker.value = null;
};

onMounted(async () => {
  try {
    const persisted = await flasherPersistenceRepository.loadLastSession();
    if (persisted) {
      store.setChipFamily(persisted.chipFamily);
      store.setFlasherType(persisted.flasherType);
      for (const [pluginId, config] of Object.entries(persisted.pluginConfigs ?? {})) {
        store.setPluginConfig(pluginId, config);
      }
      if ("downloadStats" in persisted) {
        store.setDownloadStats({
          successCount: persisted.downloadStats?.successCount ?? 0,
          failedCount: persisted.downloadStats?.failedCount ?? 0,
        });
      }
      await nextTick();
      if (persisted.firmwareRows?.length) {
        firmwareInput.value?.restoreFirmwareRows(persisted.firmwareRows);
      }
    }
  } catch (error) {
    flasherLogger.warning(error instanceof Error ? error.message : String(error));
  } finally {
    store.setFlasherRuntime(getFlasherRuntimeInfo());
    isHydratingPersistence.value = false;
  }
});
</script>

<template>
  <main class="workspace">
    <NFloatButton
      v-if="!logPanelExpanded"
      class="log-float-toggle"
      shape="square"
      @click="expandLogPanel"
    >
      <span class="float-inner">
        <NIcon
          :component="DocumentTextOutline"
          :size="18"
        />
        <span>{{ t("log.show") }}</span>
      </span>
    </NFloatButton>
    <Splitpanes
      class="split-layout"
      @resized="onPaneResized"
    >
      <Pane
        :size="logPanelExpanded ? Math.max(100 - rightPanePercent, 30) : 100"
        :min-size="logPanelExpanded ? 30 : 96"
      >
        <section class="main">
          <div class="page-head">
            <h1>{{ t("app.title") }}</h1>
            <LanguageSwitcher />
          </div>
          <TargetSelector
            :value="store.chipFamily"
            @update:value="onTargetSelected"
          />
          <FlasherSelector
            :value="store.flasherType"
            :options="flasherOptions"
            :subtitle="flasherSubtitle"
            :config-schema="currentPluginConfigSchema"
            :config="currentPluginConfig"
            @update:value="onFlasherSelected"
            @reenter="onFlasherReenter"
            @update:field="onPluginConfigFieldUpdate"
          />
          <FirmwareInputPanel ref="firmwareInput" />
          <DownloadPanel
            :can-start="store.canStartDownload"
            :download-result="store.downloadResult"
            :runtime-phase="store.runtimePhase"
            :progress-percent="store.progressPercent"
            :bytes-per-second="store.bytesPerSecond"
            :eta-seconds="store.etaSeconds"
            :success-count="store.downloadStats.successCount"
            :failed-count="store.downloadStats.failedCount"
            @download="download"
            @clear-stats="store.clearDownloadStats"
          />
          <TargetVariantDialog
            :open="store.targetPickerOpen"
            :candidates="store.targetCandidates"
            @confirm="onTargetConfirm"
            @cancel="onTargetCancel"
          />
        </section>
      </Pane>
      <Pane
        :size="logPanelExpanded ? rightPanePercent : 0"
        :min-size="logPanelExpanded ? 18 : 0"
        :max-size="logPanelExpanded ? 48 : 4"
      >
        <LogSidebar
          :expanded="logPanelExpanded"
          :logs="store.filteredLogs"
          @collapse="collapseLogPanel"
        />
      </Pane>
    </Splitpanes>
  </main>
</template>

<style scoped>
.workspace {
  min-height: 100vh;
  background: var(--workspace-bg);
  position: relative;
}
.split-layout {
  min-height: 100vh;
}
.main {
  padding: 24px;
  display: grid;
  gap: 16px;
  align-content: start;
  max-width: 1200px;
}
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.page-head h1 {
  margin: 0;
  font-size: 30px;
  line-height: 1.1;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}
:global(.splitpanes__splitter) {
  background: color-mix(in srgb, var(--border-default) 40%, transparent);
}
:global(.splitpanes__splitter:hover) {
  background: color-mix(in srgb, var(--brand-500) 45%, transparent);
}
.log-float-toggle {
  position: fixed;
  top: 88px;
  right: 18px;
  z-index: 30;
}
.float-inner {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}
</style>
