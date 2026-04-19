import { ErrorCode } from "@/core/errors/ErrorCode";
import { getFirmwareSegmentsFromTask } from "@/core/firmware/normalizeFirmwareToSegments";
import type { DownloadTaskInput, FlashPlan, StageProgress } from "@/core/types/download";
import {
  mapDfuProbeError,
  mapDfuResetError,
  mapDfuSyncError,
  mapDfuWriteError,
  toDownloadError,
} from "@/protocols/stm32/dfu/adapters/DfuErrorMapper";
import { WebDfuAdapter } from "@/protocols/stm32/dfu/adapters/WebDfuAdapter";
import type { FlasherProtocol, ProbeResult } from "@/protocols/types";
import type { UsbTransport } from "@/transports/types";

const DEFAULT_TRANSFER_SIZE = 2048;

export class Stm32DfuProtocol implements FlasherProtocol {
  private readonly adapter = new WebDfuAdapter();

  constructor(private readonly transport: UsbTransport) {}

  async probe(): Promise<ProbeResult> {
    try {
      await this.adapter.connect(this.transport.getDevice());
      return { chipFamily: "stm32", chipName: this.adapter.chipName };
    } catch (cause) {
      throw mapDfuProbeError(cause);
    }
  }

  async sync(): Promise<void> {
    try {
      await this.adapter.syncToIdle();
    } catch (cause) {
      throw mapDfuSyncError(cause);
    }
  }

  async buildPlan(input: unknown): Promise<FlashPlan> {
    const payload = input as DownloadTaskInput;
    const segments = getFirmwareSegmentsFromTask(payload);
    const app = segments.find((s) => s.slotId === "app") ?? segments[0];
    if (!app) {
      throw toDownloadError(
        ErrorCode.FlashPlanInvalid,
        "STM32 USB DFU 需要有效固件段",
        new Error("Invalid STM32 USB DFU input"),
      );
    }
    return {
      chipFamily: "stm32",
      segments: [{ address: app.address, data: app.data, label: app.label ?? "app" }],
    };
  }

  async erase(_plan: FlashPlan): Promise<void> {
    // DfuSe erase is coupled with address mapping and is handled in write().
  }

  async write(plan: FlashPlan, onProgress: (progress: StageProgress) => void): Promise<void> {
    const segment = plan.segments[0];
    const bytesTotal = segment.data.byteLength;
    onProgress({
      stage: "flashing",
      stagePercent: 0,
      totalPercent: 0,
      bytesWritten: 0,
      bytesTotal,
    });

    try {
      await this.adapter.eraseAndWrite({
        startAddress: segment.address,
        data: segment.data,
        transferSize: DEFAULT_TRANSFER_SIZE,
        onProgress: (writtenBytes, totalBytes) => {
          const percent = totalBytes > 0 ? Math.floor((writtenBytes / totalBytes) * 100) : 0;
          onProgress({
            stage: "flashing",
            stagePercent: percent,
            totalPercent: percent,
            bytesWritten: writtenBytes,
            bytesTotal,
          });
        },
      });
    } catch (cause) {
      throw mapDfuWriteError(cause);
    }
  }

  async verify(): Promise<void> {
    // Optional: no verify for now.
  }

  async reset(): Promise<void> {
    try {
      await this.adapter.resetAndDetach();
    } catch (cause) {
      throw mapDfuResetError(cause);
    }
  }
}
