<script setup lang="ts">
import { computed } from "vue";
import { NSelect } from "naive-ui";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  value: string;
  options: Array<{ value: string; labelI18nKey: string }>;
}>();

const emit = defineEmits<{
  "update:value": [value: string];
}>();

const { t } = useI18n();

const selectOptions = computed(() => props.options.map((opt) => ({ value: opt.value, label: t(opt.labelI18nKey) })));
</script>

<template>
  <NSelect
    :value="props.value"
    :options="selectOptions"
    @update:value="(v) => emit('update:value', String(v))"
  />
</template>
