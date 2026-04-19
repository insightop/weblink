import type { PluginConfigObject } from "@/plugins/config/pluginConfig.types";
import { normalizeConfigBySchema } from "@/plugins/config/pluginConfig.validators";
import { esp32SerialPolicy } from "@/plugins/firmwareInputPresets";
import type { FlasherPlugin } from "@/plugins/types";
import { Esp32SerialProtocol } from "@/protocols/esp32/serial/Esp32SerialProtocol";
import { WebSerialTransport } from "@/transports/serial/WebSerialTransport";
import type { SerialTransport } from "@/transports/types";

const ESP32_SERIAL_CONFIG_SCHEMA = {
  fields: [
    {
      key: "baudRate",
      type: "preset-number" as const,
      labelI18nKey: "pluginConfig.esp32.baudRate.label",
      helpI18nKey: "pluginConfig.esp32.baudRate.help",
      presets: [115200, 230400, 460800, 921600],
      allowCustom: true,
      min: 9600,
      max: 2000000,
      step: 100,
    },
    {
      key: "esptoolDebugLogging",
      type: "boolean" as const,
      labelI18nKey: "pluginConfig.esp32.esptoolDebugLogging.label",
      helpI18nKey: "pluginConfig.esp32.esptoolDebugLogging.help",
    },
  ],
};

function defaultConfig(): PluginConfigObject {
  return { baudRate: 460800, esptoolDebugLogging: false };
}

function normalizeConfig(raw: Record<string, unknown> | undefined): PluginConfigObject {
  return normalizeConfigBySchema(defaultConfig(), ESP32_SERIAL_CONFIG_SCHEMA.fields, raw);
}

export const esp32SerialPlugin: FlasherPlugin = {
  id: "esp32-serial",
  displayName: "ESP32 Serial",
  chipFamily: "esp32",
  flasherType: "serial",
  canSelectConnection: true,
  canFlash: true,
  priority: 100,
  supportedInputs: ["single-bin", "multi-image"],
  firmwareInputPolicy: esp32SerialPolicy,
  featureFlags: ["single-bin", "partition-table", "multi-image"],
  configSchema: ESP32_SERIAL_CONFIG_SCHEMA,
  createDefaultConfig: defaultConfig,
  normalizeConfig,
  supports: ({ chipFamily, flasherType, capabilities }) =>
    chipFamily === "esp32" && flasherType === "serial" && capabilities.webSerial,
  createTransport: (config) => {
    const normalized = normalizeConfig(config);
    return new WebSerialTransport(Number(normalized.baudRate));
  },
  createProtocol: (transport, _deps, config) => {
    const normalized = normalizeConfig(config);
    return new Esp32SerialProtocol(transport as SerialTransport, {
      baudRate: Number(normalized.baudRate),
      esptoolDebugLogging: Boolean(normalized.esptoolDebugLogging),
    });
  },
};
