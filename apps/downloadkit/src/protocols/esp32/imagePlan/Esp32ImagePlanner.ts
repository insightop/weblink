import type { FlashPlan, FlashSegment, FirmwareSegmentPayload } from "@/core/types/download";

export interface Esp32SingleBinInput {
  kind: "single-bin";
  address?: number;
  data: Uint8Array;
  label?: string;
}

export interface Esp32MultiImageInput {
  kind: "multi-image";
  bootloader: Uint8Array;
  partitionTable: Uint8Array;
  app: Uint8Array;
  otaData?: Uint8Array;
  addresses?: {
    bootloader?: number;
    partitionTable?: number;
    app?: number;
    otaData?: number;
  };
}

export type Esp32ImageInput = Esp32SingleBinInput | Esp32MultiImageInput;

const DEFAULT_ADDR = {
  bootloader: 0x1000,
  partitionTable: 0x8000,
  otaData: 0xe000,
  app: 0x10000,
};

export class Esp32ImagePlanner {
  /**
   * 由规范段载荷直接生成 Flash 计划（按地址排序，与槽位名无关）。
   */
  buildPlanFromSegmentPayloads(items: FirmwareSegmentPayload[]): FlashPlan {
    const segments: FlashSegment[] = items
      .filter((s) => s.data.byteLength > 0)
      .map((i) => ({
        address: i.address,
        data: i.data,
        label: i.label ?? i.note ?? i.slotId,
      }));
    this.validateSegments(segments);
    return { chipFamily: "esp32", segments: [...segments].sort((a, b) => a.address - b.address) };
  }

  buildPlan(input: Esp32ImageInput): FlashPlan {
    const segments: FlashSegment[] = [];
    if (input.kind === "single-bin") {
      segments.push({
        address: input.address ?? DEFAULT_ADDR.app,
        data: input.data,
        label: input.label ?? "app",
      });
    } else {
      segments.push({
        address: input.addresses?.bootloader ?? DEFAULT_ADDR.bootloader,
        data: input.bootloader,
        label: "bootloader",
      });
      segments.push({
        address: input.addresses?.partitionTable ?? DEFAULT_ADDR.partitionTable,
        data: input.partitionTable,
        label: "partition-table",
      });
      if (input.otaData) {
        segments.push({
          address: input.addresses?.otaData ?? DEFAULT_ADDR.otaData,
          data: input.otaData,
          label: "ota-data",
        });
      }
      segments.push({
        address: input.addresses?.app ?? DEFAULT_ADDR.app,
        data: input.app,
        label: "app",
      });
    }
    this.validateSegments(segments);
    return { chipFamily: "esp32", segments: segments.sort((a, b) => a.address - b.address) };
  }

  private validateSegments(segments: FlashSegment[]): void {
    if (!segments.length) throw new Error("ESP32 flash plan is empty");
    const sorted = [...segments].sort((a, b) => a.address - b.address);
    for (let i = 0; i < sorted.length; i += 1) {
      if (sorted[i].address < 0) throw new Error("Address cannot be negative");
      const currentEnd = sorted[i].address + sorted[i].data.byteLength;
      const next = sorted[i + 1];
      if (next && currentEnd > next.address) {
        throw new Error(`Image overlap detected: ${sorted[i].label ?? "segment"} -> ${next.label ?? "segment"}`);
      }
    }
  }
}
