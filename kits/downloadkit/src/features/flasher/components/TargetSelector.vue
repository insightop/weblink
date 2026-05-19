<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { NButton, NButtonGroup } from "naive-ui";
import { HardwareChipOutline } from "@vicons/ionicons5";
import FunctionZone from "@/features/flasher/components/FunctionZone.vue";
import { TARGET_CATALOG } from "@/features/flasher/presentation/targetCatalog";
import type { ChipFamily } from "@/plugins/types";

const { t } = useI18n();

const props = defineProps<{ value: ChipFamily | null }>();
const emit = defineEmits<{ "update:value": [value: ChipFamily] }>();

const options = TARGET_CATALOG.map((item) => ({ id: item.id, label: item.label }));

const subtitle = computed(() => {
  const current = props.value ? TARGET_CATALOG.find((item) => item.id === props.value) : null;
  if (current) return `${t("target.supportedSeriesPrefix")}${current.supportedSeries.join(" / ")}`;
  // 未选择目标时，不展示任何“支持系列”，避免用户误解为全部都支持
  return "";
});
</script>

<template>
  <FunctionZone
    :title="t('zones.target')"
    :subtitle="subtitle"
    :title-icon="HardwareChipOutline"
    help-key="target"
  >
    <NButtonGroup
      class="row"
      :class="`row--count-${options.length}`"
    >
      <NButton
        v-for="option in options"
        :key="option.id"
        class="btn"
        :type="props.value === option.id ? 'primary' : 'default'"
        @click="emit('update:value', option.id)"
      >
        {{ option.label }}
      </NButton>
    </NButtonGroup>
  </FunctionZone>
</template>

<style scoped>
.row {
  display: grid;
  width: 100%;
}
.row--count-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.row--count-4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.btn {
  text-transform: uppercase;
  font-weight: 600;
}
</style>

