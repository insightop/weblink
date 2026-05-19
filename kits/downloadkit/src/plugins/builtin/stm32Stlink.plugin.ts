import type { PluginConfigObject } from "@/plugins/config/pluginConfig.types";
import { normalizeConfigBySchema } from "@/plugins/config/pluginConfig.validators";
import { stm32UserAddressPolicy } from "@/plugins/firmwareInputPresets";
import type { FlasherPlugin } from "@/plugins/types";
import { Stm32StlinkProtocol } from "@/protocols/stm32/stlink/Stm32StlinkProtocol";
import { WebUsbTransport } from "@/transports/usb/WebUsbTransport";
import type { UsbTransport } from "@/transports/types";

const STLINK_CONFIG_SCHEMA = {
  fields: [
    {
      key: "debugInterface",
      type: "select" as const,
      labelI18nKey: "pluginConfig.stlink.debugInterface.label",
      helpI18nKey: "pluginConfig.stlink.debugInterface.help",
      options: [
        { value: "swd", labelI18nKey: "pluginConfig.stlink.debugInterface.option.swd" },
        { value: "jtag", labelI18nKey: "pluginConfig.stlink.debugInterface.option.jtag" },
      ],
    },
    {
      key: "debugClockHz",
      type: "preset-number" as const,
      labelI18nKey: "pluginConfig.stlink.debugClockHz.label",
      helpI18nKey: "pluginConfig.stlink.debugClockHz.help",
      presets: [100000, 125000, 240000, 480000, 950000, 1200000, 1800000, 4000000],
      allowCustom: true,
      min: 5000,
      max: 4000000,
      step: 1000,
    },
  ],
};

function defaultConfig(): PluginConfigObject {
  return { debugInterface: "swd", debugClockHz: 1800000 };
}

function normalizeConfig(raw: Record<string, unknown> | undefined): PluginConfigObject {
  return normalizeConfigBySchema(defaultConfig(), STLINK_CONFIG_SCHEMA.fields, raw);
}

export const stm32StlinkPlugin: FlasherPlugin = {
  id: "stm32-st-link",
  displayName: "STM32 ST-Link",
  chipFamily: "stm32",
  flasherType: "st-link",
  canSelectConnection: true,
  canFlash: true,
  priority: 100,
  supportedInputs: ["single-bin"],
  firmwareInputPolicy: stm32UserAddressPolicy,
  featureFlags: ["verify", "auto-reset"],
  configSchema: STLINK_CONFIG_SCHEMA,
  createDefaultConfig: defaultConfig,
  normalizeConfig,
  supports: ({ chipFamily, flasherType, capabilities }) =>
    chipFamily === "stm32" && flasherType === "st-link" && capabilities.webUsb,
  createTransport: () => new WebUsbTransport([{ vendorId: 0x0483 }]),
  createProtocol: (transport, deps, config) =>
    new Stm32StlinkProtocol(
      transport as UsbTransport,
      deps?.pickStlinkTarget,
      normalizeConfig(config),
    ),
};
