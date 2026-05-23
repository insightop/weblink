<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NCheckbox, NDataTable, NModal } from "naive-ui";
import type { DataTableColumns } from "naive-ui";
import { useI18n } from "vue-i18n";
import type { StlinkTargetVariant } from "../../../transports/adapters/stlink.adapter";
import { UI_Z_INDEX } from "@weblink/utils/ui";

const props = defineProps<{
  open: boolean;
  candidates: StlinkTargetVariant[];
}>();

const emit = defineEmits<{
  confirm: [payload: { type: string; remember: boolean }];
  cancel: [];
}>();

const { t } = useI18n();
const remember = ref(false);
const dash = "—";

watch(
  () => props.open,
  (v) => {
    if (v) remember.value = false;
  },
);

const onUpdateShow = (show: boolean): void => {
  if (!show) emit("cancel");
};

const tableScrollXMin = computed(() => {
  const maxTypeLen = props.candidates.reduce((m, r) => Math.max(m, r.type.length), 0);
  const typeCol = 56 + maxTypeLen * 9;
  return Math.min(4500, Math.max(520, typeCol + 200 + 200 + 200));
});

const columns = computed((): DataTableColumns<StlinkTargetVariant> => [
  {
    title: t("target.columns.family"),
    key: "type",
    minWidth: 120,
  },
  {
    title: t("target.columns.clock"),
    key: "freq",
    minWidth: 96,
    render: (row) =>
      row.freq != null ? `${row.freq} ${t("target.units.mhz")}` : dash,
  },
  {
    title: t("target.columns.flash"),
    key: "flash_size",
    minWidth: 88,
    render: (row) =>
      row.flash_size != null ? `${row.flash_size} ${t("target.units.kb")}` : dash,
  },
  {
    title: t("target.columns.ram"),
    key: "sram_size",
    minWidth: 88,
    render: (row) =>
      row.sram_size != null ? `${row.sram_size} ${t("target.units.kb")}` : dash,
  },
]);

const rowProps = (row: StlinkTargetVariant) => ({
  style: "cursor: pointer",
  onClick: () => emit("confirm", { type: row.type, remember: remember.value }),
});

const rowKey = (row: StlinkTargetVariant, index: number): string => `${row.type}:${index}`;
</script>

<template>
  <NModal
    :show="open"
    preset="card"
    :title="t('target.title')"
    :z-index="UI_Z_INDEX.targetPickerModal"
    :mask-closable="false"
    :closable="true"
    :auto-focus="false"
    class="target-modal"
    @update:show="onUpdateShow"
  >
    <div class="body">
      <div class="target-table-scroll">
        <NDataTable
          class="target-table"
          size="small"
          :columns="columns"
          :data="candidates"
          :bordered="true"
          :single-line="false"
          :scroll-x="tableScrollXMin"
          :max-height="360"
          :row-key="rowKey"
          :row-props="rowProps"
        />
      </div>
      <NCheckbox
        v-model:checked="remember"
        class="remember"
      >
        {{ t("target.remember") }}
      </NCheckbox>
    </div>
  </NModal>
</template>

<style scoped>
.body {
  display: grid;
  gap: 12px;
  width: fit-content;
  max-width: min(460px, 92vw);
}
.remember {
  justify-self: start;
}
.target-table-scroll {
  max-width: min(460px, 92vw);
  overflow-x: auto;
  overflow-y: hidden;
}
.target-table :deep(.n-data-table-th),
.target-table :deep(.n-data-table-td) {
  white-space: nowrap;
}
.target-table :deep(.n-data-table-tbody .n-data-table-tr:hover .n-data-table-td) {
  background: color-mix(in srgb, var(--brand-500) 34%, transparent) !important;
}
</style>

<style>
.target-modal.n-modal.n-card {
  width: fit-content !important;
  max-width: min(460px, 92vw);
}
</style>
