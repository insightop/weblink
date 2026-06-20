import type { PluginConfigObject } from "../config/pluginConfig.types";
import { normalizeConfigBySchema } from "../config/pluginConfig.validators";
import { stm32FixedAddressPolicy } from "../firmwareInputPresets";
import type { FlasherPlugin } from "../types";
import { Ch32SerialProtocol } from "../../protocols/ch32/serial/Ch32SerialProtocol";
import { WebSerialTransport } from "@weblink/device-session";
import type { SerialTransport } from "../../transports/types";

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
      max: 2_000_000,
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

export const ch32SerialPlugin: FlasherPlugin = {
  id: "ch32-serial",
  displayName: "CH32 Serial (WCH ISP)",
  chipFamily: "ch32",
  flasherType: "serial",
  connectionType: "serial",
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
    chipFamily === "ch32" && flasherType === "serial" && capabilities.webSerial,
  createTransport: (config) => {
    const normalized = normalizeConfig(config);
    return new WebSerialTransport(Number(normalized.baudRate));
  },
  createProtocol: (transport) => new Ch32SerialProtocol(transport as SerialTransport),
};
