export type PluginConfigPrimitive = string | number | boolean;

export interface PluginConfigBaseField {
  key: string;
  labelI18nKey: string;
  helpI18nKey?: string;
}

export interface PluginNumberField extends PluginConfigBaseField {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
}

export interface PluginPresetNumberField extends PluginConfigBaseField {
  type: "preset-number";
  presets: number[];
  allowCustom: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export interface PluginSelectField extends PluginConfigBaseField {
  type: "select";
  options: Array<{ value: string; labelI18nKey: string }>;
}

export interface PluginBooleanField extends PluginConfigBaseField {
  type: "boolean";
}

export type PluginConfigField =
  | PluginNumberField
  | PluginPresetNumberField
  | PluginSelectField
  | PluginBooleanField;

export interface PluginConfigSchema {
  fields: PluginConfigField[];
}

export type PluginConfigObject = Record<string, PluginConfigPrimitive>;

export interface Stm32SerialPluginConfig {
  baudRate: number;
}

export interface Stm32StlinkPluginConfig {
  debugInterface: "swd" | "jtag";
  debugClockHz: number;
}

export interface Esp32SerialPluginConfig {
  baudRate: number;
  esptoolDebugLogging?: boolean;
}

export interface PluginConfigMap {
  "stm32-serial": Stm32SerialPluginConfig;
  "stm32-st-link": Stm32StlinkPluginConfig;
  "stm32-usb-dfu": Record<string, never>;
  "stm32-dap-link": Record<string, never>;
  "esp32-serial": Esp32SerialPluginConfig;
  "gd32-serial": Stm32SerialPluginConfig;
  "gd32-usb-dfu": Record<string, never>;
  "ch32-serial": Stm32SerialPluginConfig;
}
