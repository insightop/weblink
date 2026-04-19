import type { DownloadTaskInput, FirmwarePayload, FirmwareSegmentPayload } from "@/core/types/download";

/**
 * 将任意历史形态的 `firmware` 联合类型规范为 `FirmwareSegmentPayload[]`，
 * 供协议层统一消费（无需再分支 `single-bin` / `multi-image`）。
 */
export function normalizeFirmwareToSegments(firmware: FirmwarePayload): FirmwareSegmentPayload[] {
  if (firmware.kind === "segments") {
    return firmware.items.map((item) => ({ ...item }));
  }
  if (firmware.kind === "single-bin") {
    return firmware.items.map((it, index) => ({
      slotId: it.label === "app" || index === 0 ? "app" : `segment-${index}`,
      address: it.address,
      data: it.data,
      label: it.label,
    }));
  }
  const f = firmware;
  const segments: FirmwareSegmentPayload[] = [
    {
      slotId: "bootloader",
      address: f.bootloader.address,
      data: f.bootloader.data,
      label: "bootloader",
    },
    {
      slotId: "partition-table",
      address: f.partitionTable.address,
      data: f.partitionTable.data,
      label: "partition-table",
    },
    {
      slotId: "app",
      address: f.app.address,
      data: f.app.data,
      label: "app",
    },
  ];
  if (f.otaData) {
    segments.push({
      slotId: "ota-data",
      address: f.otaData.address,
      data: f.otaData.data,
      label: "ota-data",
    });
  }
  return segments;
}

/** 从完整任务输入取规范段列表（协议 `buildPlan` 入口）。 */
export function getFirmwareSegmentsFromTask(task: DownloadTaskInput): FirmwareSegmentPayload[] {
  return normalizeFirmwareToSegments(task.firmware);
}
