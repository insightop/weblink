<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { NButton, NButtonGroup } from "naive-ui";
import { FlashOutline } from "@vicons/ionicons5";
import FunctionZone from "./FunctionZone.vue";
import PluginConfigPanel from "./PluginConfigPanel.vue";
import type { FlasherOption } from "../services/flasherFacade";
import type { PluginConfigObject, PluginConfigSchema } from "../../../plugins/config/pluginConfig.types";
import type { DeviceStatus } from "../stores/flasher.store";

const { t } = useI18n();

const props = defineProps<{
  value: "serial" | "usb-dfu" | "st-link" | "dap-link" | null;
  options: FlasherOption[];
  subtitle: string;
  status: DeviceStatus;
  configSchema: PluginConfigSchema | null;
  config: PluginConfigObject;
}>();
const emit = defineEmits<{
  "update:value": [value: "serial" | "usb-dfu" | "st-link" | "dap-link"];
  reenter: [];
  "update:field": [key: string, value: string | number | boolean];
}>();

function buttonType(option: FlasherOption): "primary" | "default" | "warning" {
  if (props.value !== option.flasherType) return "default";
  if (props.status === "pending" || props.status === "disconnected") return "warning";
  if (props.status === "ready") return "primary";
  return "default";
}

function onClickFlasher(value: "serial" | "usb-dfu" | "st-link" | "dap-link"): void {
  if (props.value === value) {
    emit("reenter");
    return;
  }
  emit("update:value", value);
}
</script>

<template>
  <FunctionZone
    :title="t('zones.flasher')"
    :subtitle="props.subtitle"
    :title-icon="FlashOutline"
    help-key="flasher"
  >
    <NButtonGroup class="row">
      <NButton
        v-for="option in props.options"
        :key="option.pluginId"
        class="btn"
        :type="buttonType(option)"
        :disabled="!option.isSupported"
        @click="onClickFlasher(option.flasherType)"
      >
        {{ option.flasherType }}
      </NButton>
    </NButtonGroup>
    <PluginConfigPanel
      :schema="props.configSchema"
      :config="props.config"
      @update:field="(key, value) => emit('update:field', key, value)"
    />
  </FunctionZone>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  width: 100%;
}
.btn {
  text-transform: uppercase;
  font-weight: 600;
}
</style>

