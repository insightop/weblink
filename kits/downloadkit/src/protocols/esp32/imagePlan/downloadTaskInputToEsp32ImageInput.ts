import type { DownloadTaskInput } from "@/core/types/download";
import { getFirmwareSegmentsFromTask } from "@/core/firmware/normalizeFirmwareToSegments";
import type { Esp32ImageInput } from "@/protocols/esp32/imagePlan/Esp32ImagePlanner";

function requireUint8(data: unknown, label: string): Uint8Array {
  if (data instanceof Uint8Array) return data;
  throw new Error(`Missing or invalid firmware bytes: ${label}`);
}

/**
 * 将应用层 {@link DownloadTaskInput} 转为旧版 {@link Esp32ImagePlanner.buildPlan} 输入。
 * 仅保留 **单段** 路径；多段请使用 {@link Esp32ImagePlanner.buildPlanFromSegmentPayloads}。
 */
export function downloadTaskInputToEsp32ImageInput(task: DownloadTaskInput): Esp32ImageInput {
  const segments = getFirmwareSegmentsFromTask(task);
  const nonEmpty = segments.filter((s) => s.data.byteLength > 0);
  if (nonEmpty.length === 0) {
    throw new Error("ESP32 firmware has no segments");
  }
  if (nonEmpty.length === 1) {
    const s = nonEmpty[0];
    return {
      kind: "single-bin",
      data: requireUint8(s.data, "segment"),
      address: s.address,
      label: s.label ?? s.slotId,
    };
  }
  throw new Error("ESP32 multi-segment firmware must use Esp32ImagePlanner.buildPlanFromSegmentPayloads");
}
