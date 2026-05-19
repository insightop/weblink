import type { DownloadTaskInput, FlashPlan, StageProgress } from "@/core/types/download";
import { ErrorCode, type DownloadError, isDownloadError } from "@/core/errors/ErrorCode";
import { flasherLogger } from "@/features/flasher/services/flasherLogger";
import { getFirmwareSegmentsFromTask } from "@/core/firmware/normalizeFirmwareToSegments";
import { Esp32ImagePlanner } from "@/protocols/esp32/imagePlan/Esp32ImagePlanner";
import type { FlasherProtocol, ProbeResult } from "@/protocols/types";
import { EsptoolJsAdapter } from "@/protocols/esp32/adapters/EsptoolJsAdapter";
import type { SerialTransport } from "@/transports/types";
import { i18n } from "@/i18n";

export interface Esp32SerialProtocolOptions {
  baudRate: number;
  esptoolDebugLogging?: boolean;
}

export class Esp32SerialProtocol implements FlasherProtocol {
  readonly defersTransportOpen = true;

  private readonly planner = new Esp32ImagePlanner();
  private readonly adapter: EsptoolJsAdapter;
  private readonly baudRate: number;

  constructor(transport: SerialTransport, options: Esp32SerialProtocolOptions) {
    this.baudRate = options.baudRate;
    this.adapter = new EsptoolJsAdapter(transport, {
      debugLogging: Boolean(options.esptoolDebugLogging),
    });
  }

  private mkError(code: ErrorCode, messageKey: string, cause: unknown): DownloadError {
    return {
      code,
      userMessage: String(i18n.global.t(messageKey)),
      debugMessage: cause instanceof Error ? cause.message : String(cause),
      cause,
    };
  }

  async probe(): Promise<ProbeResult> {
    const info = await this.adapter.connect(this.baudRate);
    const chipName = info.chipName || "ESP32";
    flasherLogger.info(
      String(i18n.global.t("logMessages.esp32ProbeOk", { chipName, baudRate: this.baudRate })),
      { chipName, baudRate: this.baudRate },
    );
    return { chipFamily: "esp32", chipName };
  }

  async sync(): Promise<void> {
    // esptool-js main() already performs sync.
  }

  async buildPlan(input: unknown): Promise<FlashPlan> {
    const task = input as DownloadTaskInput;
    if (!task?.firmware) {
      throw this.mkError(ErrorCode.FlashPlanInvalid, "esp.flashPlanInvalid", new Error("Missing firmware payload"));
    }
    try {
      const segments = getFirmwareSegmentsFromTask(task);
      return this.planner.buildPlanFromSegmentPayloads(segments);
    } catch (cause) {
      if (isDownloadError(cause)) throw cause;
      throw this.mkError(ErrorCode.FlashPlanInvalid, "esp.flashPlanInvalid", cause);
    }
  }

  async erase(_plan: FlashPlan): Promise<void> {
    // writeFlash handles erase strategy via options.
  }

  async write(plan: FlashPlan, onProgress: (progress: StageProgress) => void): Promise<void> {
    const bytesTotal = plan.segments.reduce((sum, segment) => sum + segment.data.byteLength, 0);
    await this.adapter.writeFlash(plan, (bytesWritten, totalBytes) => {
      const denominator = totalBytes > 0 ? totalBytes : bytesTotal;
      const totalPercent = denominator > 0 ? Math.floor((bytesWritten / denominator) * 100) : 0;
      onProgress({
        stage: "flashing",
        stagePercent: totalPercent,
        totalPercent,
        bytesWritten,
        bytesTotal: denominator,
      });
    });
  }

  async verify(_plan: FlashPlan): Promise<void> {
    // esptool-js includes md5 verification in writeFlash path.
  }

  async reset(): Promise<void> {
    try {
      await this.adapter.reset();
    } finally {
      await this.adapter.disconnect();
    }
  }
}
