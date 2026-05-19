<script setup lang="ts">
import { NIcon, NSelect } from "naive-ui";
import { LanguageOutline } from "@vicons/ionicons5";
import { useI18n } from "vue-i18n";
import { computed, h } from "vue";
import { storeToRefs } from "pinia";
import { useUiStore, type LocaleMode } from "@/stores/ui.store";

const { t } = useI18n();
const ui = useUiStore();
const { localeMode } = storeToRefs(ui);

const options = computed(() => [
  { label: t("language.auto"), value: "auto" as LocaleMode },
  { label: t("language.zh"), value: "zh-CN" as LocaleMode },
  { label: t("language.en"), value: "en-US" as LocaleMode },
]);

const renderTag = (): ReturnType<typeof h> =>
  h(NIcon, { size: 18, class: "lang-icon" }, { default: () => h(LanguageOutline) });
</script>

<template>
  <NSelect
    v-model:value="localeMode"
    size="small"
    class="narrow-select"
    :options="options"
    :consistent-menu-width="false"
    :render-tag="renderTag"
  />
</template>

<style scoped>
.narrow-select {
  width: 44px;
  min-width: 44px;
}
.narrow-select :deep(.n-base-selection) {
  --n-padding-single: 0 6px 0 8px;
}
.narrow-select :deep(.n-base-selection-label),
.narrow-select :deep(.n-base-selection-input) {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
