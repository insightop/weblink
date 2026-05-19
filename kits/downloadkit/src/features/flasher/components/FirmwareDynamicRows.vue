<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { NButton, NInput, NText, NUpload, NUploadDragger, type UploadFileInfo } from "naive-ui";
import { AddOutline, CloseCircle, TrashOutline } from "@vicons/ionicons5";
import type { FirmwareInputPolicy } from "@/plugins/types";
import type { FirmwareRowDraft } from "@/core/firmware/firmwareRowDraft";
import { createFirmwareRow } from "@/core/firmware/firmwareRowDraft";
import { formatBytes } from "@/shared/format/formatBytes";

const props = defineProps<{
  policy: FirmwareInputPolicy;
  modelValue: FirmwareRowDraft[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: FirmwareRowDraft[]];
}>();

const { t } = useI18n();

/** 支持多行固件时展示行尾删除与底部添加（仅图标）。单行策略下隐藏以保持简洁。 */
const showMultiRowChrome = computed(() => props.policy.maxRows > 1);

function emitRows(next: FirmwareRowDraft[]): void {
  emit("update:modelValue", next);
}

function updateRow(index: number, patch: Partial<FirmwareRowDraft>): void {
  const next = props.modelValue.map((r, i) => (i === index ? { ...r, ...patch } : r));
  emitRows(next);
}

function uploadListFor(row: FirmwareRowDraft): UploadFileInfo[] {
  return row.file
    ? [{ id: row.rowId, name: row.file.name, status: "finished", file: row.file }]
    : [];
}

function onFileListUpdate(index: number, list: UploadFileInfo[]): void {
  const latest = list[0] ?? null;
  updateRow(index, { file: latest?.file ?? null });
}

function clearFile(index: number): void {
  updateRow(index, { file: null });
}

function fileSummary(row: FirmwareRowDraft): string {
  if (!row.file) return t("firmware.selectFile");
  return `${row.file.name} · ${formatBytes(row.file.size)}`;
}

function removeRow(index: number): void {
  if (props.modelValue.length <= props.policy.minRows) return;
  const next = props.modelValue.filter((_, i) => i !== index);
  emitRows(next);
}

function addRow(): void {
  if (props.modelValue.length >= props.policy.maxRows) return;
  const def = props.policy.defaultAppAddress;
  const addrStr = def != null ? `0x${def.toString(16)}` : "";
  emitRows([...props.modelValue, createFirmwareRow({ addressStr: addrStr })]);
}

const canAdd = computed(() => props.modelValue.length < props.policy.maxRows);
const defaultAddrPlaceholder = computed(() => {
  const d = props.policy.defaultAppAddress;
  return d != null ? `0x${d.toString(16)}` : "0x10000";
});

/** 只读地址框的悬停说明（固定地址 / HEX 解析策略） */
const addrInputTitle = computed(() => {
  const p = props.policy;
  if (!p.showAddressColumn || p.addressUserEditable) return undefined;
  return t("firmware.addressResolvedHint");
});
</script>

<template>
  <div class="firmware-table-block">
    <div
      class="fw-grid"
      :class="{
        'has-actions': showMultiRowChrome,
      }"
    >
      <!-- 数据行 -->
      <template
        v-for="(row, index) in modelValue"
        :key="row.rowId"
      >
        <div class="fw-cell file-col">
          <NUpload
            :default-upload="false"
            :show-file-list="false"
            :max="1"
            :file-list="uploadListFor(row)"
            accept=".hex,.bin,.elf"
            @update:file-list="onFileListUpdate(index, $event)"
          >
            <NUploadDragger class="slot-dragger">
              <div class="file-pill">
                <NText
                  depth="2"
                  class="file-pill-text"
                  :title="fileSummary(row)"
                >
                  {{ fileSummary(row) }}
                </NText>
                <NButton
                  v-if="row.file"
                  quaternary
                  circle
                  size="tiny"
                  class="file-pill-clear"
                  :aria-label="t('firmware.clearFile')"
                  @click.stop="clearFile(index)"
                >
                  <template #icon>
                    <CloseCircle />
                  </template>
                </NButton>
              </div>
            </NUploadDragger>
          </NUpload>
        </div>
        <div class="fw-cell addr-col">
          <template v-if="policy.showAddressColumn">
            <NInput
              class="addr-input"
              :value="row.addressStr"
              size="medium"
              :disabled="!policy.addressUserEditable"
              :placeholder="defaultAddrPlaceholder"
              :title="addrInputTitle"
              :aria-label="t('firmware.flashAddress')"
              @update:value="updateRow(index, { addressStr: $event ?? '' })"
            />
          </template>
          <div
            v-else
            class="addr-placeholder"
          >
            <NText
              depth="3"
              class="addr-dash"
            >
              {{ t("firmware.addressHiddenHint") }}
            </NText>
          </div>
        </div>
        <div
          v-if="showMultiRowChrome"
          class="fw-cell actions-col"
        >
          <NButton
            quaternary
            circle
            type="error"
            size="small"
            :disabled="modelValue.length <= policy.minRows"
            :aria-label="t('firmware.removeRow')"
            @click="removeRow(index)"
          >
            <template #icon>
              <TrashOutline />
            </template>
          </NButton>
        </div>
      </template>
    </div>

    <div
      v-if="showMultiRowChrome"
      class="add-row-center"
    >
      <NButton
        quaternary
        circle
        size="medium"
        :disabled="!canAdd"
        :aria-label="t('firmware.addRow')"
        @click="addRow"
      >
        <template #icon>
          <AddOutline />
        </template>
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.firmware-table-block {
  width: 100%;
  margin-top: 4px;
}
.fw-grid {
  --fw-control-height: 34px;
  display: grid;
  width: 100%;
  gap: 10px 12px;
  /* 行内各列顶对齐，避免「一列居中、一列拉伸」导致视觉上高低不一 */
  align-items: start;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
}
.fw-grid.has-actions {
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto;
}
.fw-cell {
  min-width: 0;
  display: flex;
  align-items: flex-start;
}
.fw-cell.file-col {
  flex-direction: column;
  align-items: stretch;
}
.fw-cell.file-col :deep(.n-upload) {
  width: 100%;
  margin: 0;
  line-height: normal;
}
.fw-cell.file-col :deep(.n-upload-trigger) {
  width: 100%;
  display: block;
}
.fw-cell.addr-col :deep(.n-input-wrapper) { margin-top: 0; }
.actions-col {
  display: flex;
  align-items: center;
  justify-content: center;
}
.addr-dash {
  font-size: 13px;
}
.addr-input {
  width: 100%;
}
.addr-placeholder {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: var(--fw-control-height);
  box-sizing: border-box;
  padding: 0 10px;
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  background-color: var(--n-action-color);
}
.slot-dragger {
  width: 100%;
  min-height: var(--fw-control-height);
  height: var(--fw-control-height);
  max-height: var(--fw-control-height);
  padding: 0 10px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}
.file-pill {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
}
.file-pill-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
}
.file-pill-clear {
  flex: 0 0 auto;
}
.add-row-center {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}
@media (max-width: 640px) {
  .firmware-table-block {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .fw-grid {
    min-width: min(100%, 520px);
  }
}
</style>
