import { getFirmwareSegmentsFromTask } from "@/core/firmware/normalizeFirmwareToSegments";
import type { DownloadTaskInput, FlashPlan, StageProgress } from "@/core/types/download";
import type { FlasherProtocol, ProbeResult } from "@/protocols/types";
import { ErrorCode, type DownloadError, isUserCancelledError } from "@/core/errors/ErrorCode";
import type { PluginConfigObject } from "@/plugins/config/pluginConfig.types";
import type { UsbTransport } from "@/transports/types";
import {
  createStlinkAdapter,
  type StlinkAdapter,
  type StlinkTargetVariant,
} from "@/transports/adapters/stlink.adapter";

export class Stm32StlinkProtocol implements FlasherProtocol {
  private adapter: StlinkAdapter | null = null;

  constructor(
    private readonly transport: UsbTransport,
    private readonly pickTargetVariant?: (candidates: StlinkTargetVariant[]) => Promise<string | null>,
    private readonly config: PluginConfigObject = { debugInterface: "swd", debugClockHz: 1800000 },
  ) {}

  private mkError(code: ErrorCode, userMessage: string, cause: unknown): DownloadError {
    const debugMessage = cause instanceof Error ? cause.message : String(cause);
    return { code, userMessage, debugMessage, cause };
  }

  async probe(): Promise<ProbeResult> {
    try {
      const adapter = createStlinkAdapter(this.transport.getDevice());
      await adapter.connect(this.pickTargetVariant, {
        debugInterface: this.config.debugInterface === "jtag" ? "jtag" : "swd",
        debugClockHz: Number(this.config.debugClockHz ?? 1800000),
      });
      this.adapter = adapter;
      return { chipFamily: "stm32", chipName: "STM32-STLink" };
    } catch (cause) {
      await this.adapter?.disconnect().catch(() => undefined);
      if (isUserCancelledError(cause)) {
        throw cause;
      }
      throw this.mkError(ErrorCode.ProbeFailed, "ST-Link 连接/探测失败", cause);
    }
  }

  async sync(): Promise<void> {}

  async buildPlan(input: unknown): Promise<FlashPlan> {
    const payload = input as DownloadTaskInput;
    const segments = getFirmwareSegmentsFromTask(payload);
    const app = segments.find((s) => s.slotId === "app") ?? segments[0];
    if (!app) {
      throw this.mkError(
        ErrorCode.FlashPlanInvalid,
        "STM32 ST-Link 需要有效固件段",
        new Error("Invalid STM32 ST-Link input"),
      );
    }
    return {
      chipFamily: "stm32",
      segments: [{ address: app.address, data: app.data, label: app.label ?? "app" }],
    };
  }

  async erase(): Promise<void> {}

  async write(plan: FlashPlan, onProgress: (progress: StageProgress) => void): Promise<void> {
    if (!this.adapter) {
      throw this.mkError(ErrorCode.TransportUnavailable, "ST-Link 尚未建立连接", new Error("Adapter unavailable"));
    }
    const segment = plan.segments[0];
    const totalBytes = segment.data.byteLength;
    this.adapter.setProgressTracker({ baseAddress: segment.address, totalBytes });
    this.adapter.setProgressHandler((writtenBytes, bytesTotal) => {
      const percent = bytesTotal > 0 ? Math.floor((writtenBytes / bytesTotal) * 100) : 0;
      onProgress({
        stage: "flashing",
        stagePercent: percent,
        totalPercent: percent,
        bytesWritten: writtenBytes,
        bytesTotal,
      });
    });
    try {
      await this.adapter.flash(segment.address, segment.data);
    } catch (cause) {
      await this.adapter.disconnect().catch(() => undefined);
      throw this.mkError(ErrorCode.FlashFailed, "ST-Link 写入 Flash 失败", cause);
    }
    onProgress({
      stage: "flashing",
      stagePercent: 100,
      totalPercent: 100,
      bytesWritten: totalBytes,
      bytesTotal: totalBytes,
    });
  }

  async verify(): Promise<void> {}

  async reset(): Promise<void> {
    if (!this.adapter) return;
    try {
      await this.adapter.reset();
    } finally {
      await this.adapter.disconnect().catch(() => undefined);
      this.adapter = null;
    }
  }
}
