import type { FlasherProtocol } from "../protocols/types";
import type {
  PluginConfigMap,
  PluginConfigObject,
  PluginConfigSchema,
} from "./config/pluginConfig.types";
import type { StlinkTargetVariant } from "../transports/adapters/stlink.adapter";
import type { Transport } from "../transports/types";

export type ChipFamily = "stm32" | "esp32" | "gd32" | "ch32";
export type FlasherType = "serial" | "usb-dfu" | "st-link" | "dap-link";

export type SupportedInput = "single-bin" | "multi-image";

export interface BrowserCapabilities {
  webSerial: boolean;
  webUsb: boolean;
  webHid: boolean;
}

export interface PluginResolveCriteria {
  chipFamily: ChipFamily;
  flasherType: FlasherType;
  capabilities: BrowserCapabilities;
}

export interface PluginRuntimeDeps {
  pickStlinkTarget?: (candidates: StlinkTargetVariant[]) => Promise<string | null>;
}

/** Intel HEX 与多行并存的策略。 */
export type HexFilePolicy = "allow" | "firstRowOnly" | "disallowMultiRow";

/**
 * 固件区 UI 与校验边界（无固定槽位名）；与动态行 `FirmwareRowDraft[]` 配合。
 *
 * `showAddressColumn` × `addressUserEditable` 真值表（第二列「烧录地址」）：
 * - `showAddressColumn: false` — 不显示地址输入列（占位「—」），忽略 `addressUserEditable`。
 * - `showAddressColumn: true`, `addressUserEditable: false` — 显示地址框，禁用编辑（只读展示草稿/占位；解析仍以 HEX/策略为准）。
 * - `showAddressColumn: true`, `addressUserEditable: true` — 显示并可编辑地址。
 *
 * `maxRows > 1` 时显示增删行；`maxRows === 1` 时隐藏增删，与地址列正交。
 */
export interface FirmwareInputPolicy {
  minRows: number;
  maxRows: number;
  defaultRows: number;
  /** 用户是否可编辑烧录地址输入框（仅当 {@link showAddressColumn} 为 true 时生效）。 */
  addressUserEditable: boolean;
  /** 是否显示第二列「烧录地址」；为 false 时不展示输入列。详见接口级真值表。 */
  showAddressColumn: boolean;
  /** 是否显示每行备注列。 */
  showNoteColumn?: boolean;
  hexFilePolicy: HexFilePolicy;
  /** `.bin` 且无用户地址、非 HEX 时的默认 app 基址（按芯片族）。 */
  defaultAppAddress?: number;
}

export interface FlasherPlugin {
  id: keyof PluginConfigMap;
  displayName: string;
  chipFamily: ChipFamily;
  flasherType: FlasherType;
  canSelectConnection: boolean;
  canFlash: boolean;
  priority: number;
  supportedInputs: SupportedInput[];
  /** 驱动固件区：行数范围、地址列、HEX 策略等。 */
  firmwareInputPolicy: FirmwareInputPolicy;
  featureFlags: string[];
  supports: (criteria: PluginResolveCriteria) => boolean;
  configSchema?: PluginConfigSchema;
  createDefaultConfig?: () => PluginConfigObject;
  normalizeConfig?: (raw: Record<string, unknown> | undefined) => PluginConfigObject;
  createTransport: (config?: PluginConfigObject) => Transport;
  createProtocol: (transport: Transport, deps?: PluginRuntimeDeps, config?: PluginConfigObject) => FlasherProtocol;
}
