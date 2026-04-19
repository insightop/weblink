import type { ChipFamily, FlasherType } from "@/plugins/types";
import type { PluginConfigObject } from "@/plugins/config/pluginConfig.types";

export interface PersistedFirmwareFile {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  blob: Blob;
}

export interface PersistedFirmwareRow {
  rowId: string;
  addressStr: string;
  note?: string;
  file: PersistedFirmwareFile | null;
}

export interface PersistedFlasherSessionV1 {
  version: 1;
  chipFamily: ChipFamily | null;
  flasherType: FlasherType | null;
  pluginConfigs: Record<string, PluginConfigObject>;
  firmwareRows: PersistedFirmwareRow[];
}

export interface PersistedFlasherSessionV2 {
  version: 2;
  chipFamily: ChipFamily | null;
  flasherType: FlasherType | null;
  pluginConfigs: Record<string, PluginConfigObject>;
  firmwareRows: PersistedFirmwareRow[];
  downloadStats: {
    successCount: number;
    failedCount: number;
  };
}

export type PersistedFlasherSession = PersistedFlasherSessionV1 | PersistedFlasherSessionV2;
