import { getFirmwareSegmentsFromTask } from "../../../core/firmware/normalizeFirmwareToSegments";
import type { DownloadTaskInput, FlashPlan, StageProgress } from "../../../core/types/download";
import { ErrorCode, type DownloadError } from "../../../core/errors/ErrorCode";
import type { FlasherProtocol, ProbeResult } from "../../types";
import { createDaplinkAdapter, type DaplinkAdapter } from "../../../transports/adapters/daplink.adapter";
import type { UsbTransport } from "../../../transports/types";

export class Stm32DaplinkProtocol implements FlasherProtocol {
  private readonly adapter: DaplinkAdapter;

  constructor(transport: UsbTransport) {
    this.adapter = createDaplinkAdapter(transport);
  }

  private mkError(code: ErrorCode, userMessage: string, cause: unknown): DownloadError {
    const debugMessage = cause instanceof Error ? cause.message : String(cause);
    return { code, userMessage, debugMessage, cause };
  }

  async probe(): Promise<ProbeResult> {
    await this.adapter.connect();
    return { chipFamily: "stm32", chipName: "STM32-DAPLink" };
  }

  async sync(): Promise<void> {}

  async buildPlan(input: unknown): Promise<FlashPlan> {
    const payload = input as DownloadTaskInput;
    const segments = getFirmwareSegmentsFromTask(payload);
    const app = segments.find((s) => s.slotId === "app") ?? segments[0];
    if (!app) {
      throw this.mkError(
        ErrorCode.FlashPlanInvalid,
        "STM32 DAP-Link 需要有效固件段",
        new Error("Invalid STM32 DAP-Link input"),
      );
    }
    return {
      chipFamily: "stm32",
      segments: [{ address: app.address, data: app.data, label: app.label ?? "app" }],
    };
  }

  async erase(): Promise<void> {}

  async write(plan: FlashPlan, onProgress: (progress: StageProgress) => void): Promise<void> {
    const mergedSize = plan.segments.reduce((sum, segment) => sum + segment.data.byteLength, 0);
    const image = new Uint8Array(mergedSize);
    let offset = 0;
    for (const segment of plan.segments) {
      image.set(segment.data, offset);
      offset += segment.data.byteLength;
    }
    await this.adapter.flash(image, (ratio) => {
      const pct = Math.min(100, Math.max(0, Math.floor(ratio * 100)));
      const written = Math.min(mergedSize, Math.floor(mergedSize * ratio));
      onProgress({
        stage: "flashing",
        stagePercent: pct,
        totalPercent: pct,
        bytesWritten: written,
        bytesTotal: mergedSize,
      });
    });
    onProgress({
      stage: "flashing",
      stagePercent: 100,
      totalPercent: 100,
      bytesWritten: mergedSize,
      bytesTotal: mergedSize,
    });
  }

  async verify(): Promise<void> {}

  async reset(): Promise<void> {
    await this.adapter.disconnect();
  }
}
