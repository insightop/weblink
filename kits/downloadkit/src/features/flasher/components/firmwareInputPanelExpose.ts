import type { ComputedRef } from "vue";
import type { DownloadTaskInput } from "../../../core/types/download";
import type { PersistedFirmwareRow } from "../persistence/schema";

/** Public API exposed by `FirmwareInputPanel` for parent coordination. */
export interface FirmwareInputPanelExpose {
  getInput: () => Promise<DownloadTaskInput>;
  firmwareFingerprint: ComputedRef<string | null>;
  firmwareTotalBytes: ComputedRef<number>;
  exportFirmwareRows: () => PersistedFirmwareRow[];
  restoreFirmwareRows: (rows: PersistedFirmwareRow[]) => void;
}
