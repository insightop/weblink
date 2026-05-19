import type { PluginConfigObject } from "@/plugins/config/pluginConfig.types";
import { normalizeConfigBySchema } from "@/plugins/config/pluginConfig.validators";
import { stm32FixedAddressPolicy } from "@/plugins/firmwareInputPresets";
import type { FlasherPlugin } from "@/plugins/types";
import { Stm32UartProtocol } from "@/protocols/stm32/serial/Stm32UartProtocol";
import { WebSerialTransport } from "@/transports/serial/WebSerialTransport";
import type { SerialTransport } from "@/transports/types";

const SERIAL_CONFIG_SCHEMA = {
  fields: [
    {
      key: "baudRate",
      type: "preset-number" as const,
      labelI18nKey: "pluginConfig.serial.baudRate.label",
      helpI18nKey: "pluginConfig.serial.baudRate.help",
      presets: [9600, 57600, 115200, 230400, 460800, 921600],
      allowCustom: true,
      min: 9600,
      max: 2000000,
      step: 100,
    },
  ],
};

function defaultConfig(): PluginConfigObject {
  return { baudRate: 115200 };
}

function normalizeConfig(raw: Record<string, unknown> | undefined): PluginConfigObject {
  return normalizeConfigBySchema(defaultConfig(), SERIAL_CONFIG_SCHEMA.fields, raw);
}

export const stm32SerialPlugin: FlasherPlugin = {
  id: "stm32-serial",
  displayName: "STM32 Serial",
  chipFamily: "stm32",
  flasherType: "serial",
  canSelectConnection: true,
  canFlash: true,
  priority: 100,
  supportedInputs: ["single-bin"],
  firmwareInputPolicy: stm32FixedAddressPolicy,
  featureFlags: ["verify", "cancel"],
  configSchema: SERIAL_CONFIG_SCHEMA,
  createDefaultConfig: defaultConfig,
  normalizeConfig,
  supports: ({ chipFamily, flasherType, capabilities }) =>
    chipFamily === "stm32" && flasherType === "serial" && capabilities.webSerial,
  createTransport: (config) => {
    const normalized = normalizeConfig(config);
    return new WebSerialTransport(Number(normalized.baudRate));
  },
  createProtocol: (transport) => new Stm32UartProtocol(transport as SerialTransport),
};
