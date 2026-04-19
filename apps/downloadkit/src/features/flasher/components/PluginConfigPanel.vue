<script setup lang="ts">
import { NSwitch } from "naive-ui";
import FormFieldRow from "@/features/flasher/components/FormFieldRow.vue";
import NumberField from "@/features/flasher/components/config-fields/NumberField.vue";
import PresetNumberField from "@/features/flasher/components/config-fields/PresetNumberField.vue";
import SelectField from "@/features/flasher/components/config-fields/SelectField.vue";
import type { PluginConfigObject, PluginConfigSchema } from "@/plugins/config/pluginConfig.types";

defineProps<{
  schema: PluginConfigSchema | null;
  config: PluginConfigObject;
}>();

const emit = defineEmits<{
  "update:field": [key: string, value: string | number | boolean];
}>();
</script>

<template>
  <div
    v-if="schema && schema.fields.length > 0"
    class="plugin-params"
  >
    <div class="config-grid">
      <FormFieldRow
        v-for="field in schema.fields"
        :key="field.key"
        :label-key="field.labelI18nKey"
        :help-key="field.helpI18nKey"
      >
        <NumberField
          v-if="field.type === 'number'"
          :value="Number(config[field.key] ?? 0)"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          @update:value="(v) => emit('update:field', field.key, v)"
        />
        <PresetNumberField
          v-else-if="field.type === 'preset-number'"
          :value="Number(config[field.key] ?? 0)"
          :presets="field.presets"
          :min="field.min"
          :max="field.max"
          @update:value="(v) => emit('update:field', field.key, v)"
        />

        <SelectField
          v-else-if="field.type === 'select'"
          :value="String(config[field.key] ?? '')"
          :options="field.options"
          @update:value="(v) => emit('update:field', field.key, v)"
        />

        <NSwitch
          v-else
          :value="Boolean(config[field.key])"
          @update:value="(v) => emit('update:field', field.key, Boolean(v))"
        />
      </FormFieldRow>
    </div>
  </div>
</template>

<style scoped>
.plugin-params {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid color-mix(in srgb, var(--border-default) 55%, transparent);
}
.config-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
