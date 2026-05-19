import type { DownloadEvent, DownloadStage } from "@/core/types/download";

type TransitionTable = Record<DownloadStage, Partial<Record<DownloadEvent, DownloadStage>>>;

const FINAL_STATES: DownloadStage[] = ["completed", "failed", "cancelled"];

export const downloadTransitionTable: TransitionTable = {
  idle: { SELECT_FIRMWARE: "selectingFirmware", CANCEL: "cancelled" },
  selectingFirmware: { START: "connecting", CANCEL: "cancelled", RESET: "idle" },
  connecting: { CONNECT_OK: "probingTarget", FAIL: "failed", CANCEL: "cancelled" },
  probingTarget: { PROBE_OK: "syncing", FAIL: "failed", CANCEL: "cancelled" },
  syncing: { SYNC_OK: "preparingImagePlan", FAIL: "failed", CANCEL: "cancelled" },
  preparingImagePlan: { PLAN_OK: "erasing", FAIL: "failed", CANCEL: "cancelled" },
  erasing: { ERASE_OK: "flashing", FAIL: "failed", CANCEL: "cancelled" },
  flashing: { FLASH_OK: "verifying", FAIL: "failed", CANCEL: "cancelled" },
  verifying: { VERIFY_OK: "resetting", FAIL: "failed", CANCEL: "cancelled" },
  resetting: { RESET_OK: "completed", FAIL: "failed", CANCEL: "cancelled" },
  completed: { RESET: "idle" },
  failed: { RESET: "idle" },
  cancelled: { RESET: "idle" },
};

export const isFinalState = (stage: DownloadStage): boolean => FINAL_STATES.includes(stage);

export function transitionStage(current: DownloadStage, event: DownloadEvent): DownloadStage {
  const next = downloadTransitionTable[current][event];
  if (!next) {
    throw new Error(`Invalid transition: ${current} + ${event}`);
  }
  return next;
}
