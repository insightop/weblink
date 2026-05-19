<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { FirmwareInputPanelExpose } from "@/features/flasher/components/firmwareInputPanelExpose";
import { useI18n } from "vue-i18n";
import { NText } from "naive-ui";
import { DocumentAttachOutline } from "@vicons/ionicons5";
import type { DownloadTaskInput } from "@/core/types/download";
import { buildFirmwareSegmentsPayload } from "@/core/firmware/buildFirmwareSegmentsPayload";
import { createEmptyRows } from "@/core/firmware/firmwareRowDraft";
import type { FirmwareRowDraft } from "@/core/firmware/firmwareRowDraft";
import FunctionZone from "@/features/flasher/components/FunctionZone.vue";
import FirmwareDynamicRows from "@/features/flasher/components/FirmwareDynamicRows.vue";
import { useFlasherStore } from "@/features/flasher/stores/flasher.store";
import { globalPluginRegistry } from "@/plugins/registry";
import { detectBrowserCapabilities, getBrowserSupportHint } from "@/plugins/capabilities";
import { flasherLogger } from "@/features/flasher/services/flasherLogger";
import type { PersistedFirmwareRow } from "@/features/flasher/persistence/schema";
import { fromPersistedFirmwareRows, toPersistedFirmwareRows } from "@/features/flasher/persistence/mappers";
import type { FirmwareInputPolicy } from "@/plugins/types";
import { formatBytes } from "@/shared/format/formatBytes";

const store = useFlasherStore();
const { t } = useI18n();

const rows = ref<FirmwareRowDraft[]>([]);

const capabilities = computed(() => detectBrowserCapabilities());
const selectedPlugin = computed(() => {
  if (!store.chipFamily || !store.flasherType) return null;
  return globalPluginRegistry.tryResolve({
    chipFamily: store.chipFamily,
    flasherType: store.flasherType,
    capabilities: capabilities.value,
  });
});

const fallbackPolicy = computed<FirmwareInputPolicy | null>(() => {
  if (!store.chipFamily) return null;
  return {
    minRows: 1,
    maxRows: 4,
    defaultRows: 1,
    addressUserEditable: true,
    showAddressColumn: true,
    showNoteColumn: false,
    hexFilePolicy: "allow",
    defaultAppAddress: store.chipFamily === "esp32" ? 0x10000 : 0x0800_0000,
  };
});

const effectivePolicy = computed<FirmwareInputPolicy | null>(() => {
  return selectedPlugin.value?.firmwareInputPolicy ?? fallbackPolicy.value;
});

watch(
  effectivePolicy,
  (policy) => {
    if (!policy) {
      rows.value = [];
      return;
    }
    // 避免用户暂未选择 flasher 时清空已上传文件。
    if (rows.value.length > 0) return;
    const p = policy;
    rows.value = createEmptyRows(p.defaultRows, p.defaultAppAddress);
  },
  { immediate: true },
);

const unavailableHint = computed(() => {
  if (!store.chipFamily) return "";
  if (!store.flasherType) return "";
  if (!selectedPlugin.value) return t("firmware.unavailable", { hint: getBrowserSupportHint(capabilities.value) });
  return "";
});

function anyElfSelected(): boolean {
  for (const row of rows.value) {
    if (row.file?.name.toLowerCase().endsWith(".elf")) return true;
  }
  return false;
}

const firmwareReady = computed((): boolean => {
  const p = effectivePolicy.value;
  if (!p || anyElfSelected()) return false;
  const filled = rows.value.filter((r) => r.file);
  if (filled.length < p.minRows) return false;
  return filled.length > 0;
});

watch(
  firmwareReady,
  (ready) => {
    store.setFirmwareReady(ready && Boolean(selectedPlugin.value));
  },
  { immediate: true },
);

function onRowsUpdate(next: FirmwareRowDraft[]): void {
  const prevById = Object.fromEntries(rows.value.map((r) => [r.rowId, r]));
  for (const r of next) {
    const p = prevById[r.rowId];
    const f = r.file;
    if (f && (!p?.file || p.file !== f)) {
      flasherLogger.info("Firmware selected", {
        rowId: r.rowId,
        fileName: f.name,
        fileSize: f.size,
        chipFamily: store.chipFamily,
        flasherType: store.flasherType,
      });
    }
  }
  rows.value = next;
}

const firmwareFingerprint = computed((): string | null => {
  if (!selectedPlugin.value) return null;
  const parts = rows.value.map((r) => [
    r.rowId,
    r.file ? [r.file.name, r.file.size, r.file.lastModified] : null,
    r.addressStr,
  ]);
  return JSON.stringify(parts);
});

const totalFirmwareBytes = computed(() => rows.value.reduce((sum, row) => sum + (row.file?.size ?? 0), 0));
const subtitle = computed(() => {
  if (totalFirmwareBytes.value <= 0) return t("firmware.noFile");
  return t("firmware.totalSize", { size: formatBytes(totalFirmwareBytes.value) });
});

defineExpose({
  firmwareFingerprint,
  firmwareTotalBytes: totalFirmwareBytes,
  exportFirmwareRows: (): PersistedFirmwareRow[] => toPersistedFirmwareRows(rows.value),
  restoreFirmwareRows: (persistedRows: PersistedFirmwareRow[]): void => {
    rows.value = fromPersistedFirmwareRows(persistedRows);
  },
  getInput: async (): Promise<DownloadTaskInput> => {
    const plugin = selectedPlugin.value;
    if (!plugin) throw new Error(unavailableHint.value || t("firmware.unavailable", { hint: "" }));

    flasherLogger.debug("Loading firmware payload", {
      chipFamily: store.chipFamily,
      flasherType: store.flasherType,
      rowCount: rows.value.length,
    });

    try {
      const firmware = await buildFirmwareSegmentsPayload({
        chipFamily: plugin.chipFamily,
        policy: plugin.firmwareInputPolicy,
        rows: rows.value,
      });
      for (const seg of firmware.items) {
        flasherLogger.trace("Segment ready", {
          slotId: seg.slotId,
          address: `0x${seg.address.toString(16)}`,
          bytes: seg.data.byteLength,
        });
      }
      return {
        flasherType: store.flasherType ?? plugin.flasherType,
        chipFamily: store.chipFamily ?? plugin.chipFamily,
        firmware,
      };
    } catch (e) {
      const code = e instanceof Error ? e.message : String(e);
      if (code === "ELF_NOT_IMPLEMENTED") {
        throw new Error(t("firmware.elfNotImplemented"));
      }
      if (code === "HEX_NOT_ALLOWED_MULTI_SLOT") {
        throw new Error(t("firmware.hexMultiSlotHint"));
      }
      if (code === "NO_FIRMWARE_SEGMENTS") {
        throw new Error(t("firmware.noFile"));
      }
      if (code === "MIN_ROWS_NOT_MET") {
        throw new Error(t("firmware.minRowsNotMet"));
      }
      throw e instanceof Error ? e : new Error(String(e));
    }
  },
} satisfies FirmwareInputPanelExpose);
</script>

<template>
  <FunctionZone
    :title="t('zones.firmware')"
    :subtitle="subtitle"
    :title-icon="DocumentAttachOutline"
    help-key="firmware"
  >
    <NText
      v-if="store.flasherHint"
      class="warn"
    >
      {{ store.flasherHint }}
    </NText>
    <NText
      v-if="unavailableHint"
      class="warn"
    >
      {{ unavailableHint }}
    </NText>
    <FirmwareDynamicRows
      v-if="effectivePolicy"
      :policy="effectivePolicy"
      :model-value="rows"
      @update:model-value="onRowsUpdate"
    />
  </FunctionZone>
</template>

<style scoped>
.warn { margin: 0; color: var(--error-500); font-size: 13px; }
</style>
