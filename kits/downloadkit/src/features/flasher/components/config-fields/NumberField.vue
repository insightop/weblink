<script setup lang="ts">
import { NInputNumber } from "naive-ui";

const props = defineProps<{
  value: number;
  min?: number;
  max?: number;
  step?: number;
}>();

const emit = defineEmits<{
  "update:value": [value: number];
}>();
</script>

<template>
  <NInputNumber
    :value="props.value"
    :min="props.min"
    :max="props.max"
    :step="props.step ?? 1"
    clearable
    @update:value="(v) => emit('update:value', Number(v ?? props.value))"
  />
</template>
