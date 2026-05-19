export type DownloadStage =
  | "idle"
  | "selectingFirmware"
  | "connecting"
  | "probingTarget"
  | "syncing"
  | "preparingImagePlan"
  | "erasing"
  | "flashing"
  | "verifying"
  | "resetting"
  | "completed"
  | "failed"
  | "cancelled";

export type DownloadEvent =
  | "SELECT_FIRMWARE"
  | "START"
  | "CONNECT_OK"
  | "PROBE_OK"
  | "SYNC_OK"
  | "PLAN_OK"
  | "ERASE_OK"
  | "FLASH_OK"
  | "VERIFY_OK"
  | "RESET_OK"
  | "FAIL"
  | "CANCEL"
  | "RESET";

export interface StageProgress {
  stage: DownloadStage;
  stagePercent: number;
  totalPercent: number;
  bytesWritten: number;
  bytesTotal: number;
  etaSeconds?: number;
}

export interface FlashSegment {
  address: number;
  data: Uint8Array;
  label?: string;
}

export interface FlashPlan {
  chipFamily: "stm32" | "esp32" | "gd32" | "ch32";
  segments: FlashSegment[];
}

/** 统一固件段载荷；`slotId` 存放稳定行键（如 UUID），兼容历史 `app` 等名。 */
export interface FirmwareSegmentPayload {
  slotId: string;
  address: number;
  data: Uint8Array;
  label?: string;
  /** 可选用户备注（不参与烧录协议语义）。 */
  note?: string;
}

/** 推荐使用的单一形态；旧形态仍可通过 {@link normalizeFirmwareToSegments} 转换。 */
export interface FirmwareSegmentsPayload {
  kind: "segments";
  items: FirmwareSegmentPayload[];
}

export type LegacySingleBinPayload = {
  kind: "single-bin";
  items: Array<{ address: number; data: Uint8Array; label?: string }>;
};

export type LegacyMultiImagePayload = {
  kind: "multi-image";
  bootloader: { address: number; data: Uint8Array };
  partitionTable: { address: number; data: Uint8Array };
  app: { address: number; data: Uint8Array };
  otaData?: { address: number; data: Uint8Array };
};

export type FirmwarePayload = FirmwareSegmentsPayload | LegacySingleBinPayload | LegacyMultiImagePayload;

export interface DownloadTaskInput {
  flasherType: string;
  mode?: string;
  chipFamily: "stm32" | "esp32" | "gd32" | "ch32";
  firmware: FirmwarePayload;
}
