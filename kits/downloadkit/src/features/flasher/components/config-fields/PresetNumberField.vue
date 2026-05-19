<script setup lang="ts">
import { computed } from "vue";
import { NSelect } from "naive-ui";
import type { SelectOption } from "naive-ui";

const props = defineProps<{
  value: number;
  presets: number[];
  min?: number;
  max?: number;
}>();

const emit = defineEmits<{
  "update:value": [value: number];
}>();

const selectOptions = computed<SelectOption[]>(() => {
  const merged = new Set(props.presets);
  merged.add(props.value);
  return [...merged]
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
    .map((n) => ({ label: String(n), value: String(n) }));
});

function onUpdate(v: string | null): void {
  if (v == null || v === "") return;
  const trimmed = v.trim();
  if (trimmed === "") return;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return;
  if (props.min != null && n < props.min) return;
  if (props.max != null && n > props.max) return;
  emit("update:value", n);
}
</script>

<template>
  <NSelect
    class="preset-number-combo"
    :value="String(props.value)"
    filterable
    tag
    clearable
    :consistent-menu-width="false"
    placeholder=""
    :options="selectOptions"
    @update:value="onUpdate"
  />
</template>

<style scoped>
.preset-number-combo {
  width: 100%;
}
</style>
