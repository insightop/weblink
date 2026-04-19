import { getFirmwareSegmentsFromTask } from "@/core/firmware/normalizeFirmwareToSegments";
import type { DownloadTaskInput, FlashPlan, StageProgress } from "@/core/types/download";
import { ErrorCode, type DownloadError } from "@/core/errors/ErrorCode";
import type { FlasherProtocol, ProbeResult } from "@/protocols/types";
import { WchUartIspSession } from "@/protocols/ch32/serial/WchUartIspSession";
import type { SerialTransport } from "@/transports/types";

export class Ch32SerialProtocol implements FlasherProtocol {
  private readonly session: WchUartIspSession;
  private connected = false;
  private chipLabel = "CH32";

  constructor(private readonly transport: SerialTransport) {
    this.session = new WchUartIspSession(transport);
  }

  private mkError(code: ErrorCode, userMessage: string, cause: unknown): DownloadError {
    const debugMessage = cause instanceof Error ? cause.message : String(cause);
    return { code, userMessage, debugMessage, cause };
  }

  async probe(): Promise<ProbeResult> {
    try {
      await this.session.open();
      const { label } = await this.session.identify();
      this.chipLabel = label;
      this.connected = true;
      return { chipFamily: "ch32", chipName: this.chipLabel };
    } catch (cause) {
      try {
        await this.session.close();
      } catch {
        /* ignore */
      }
      this.connected = false;
      throw this.mkError(ErrorCode.ProbeFailed, "CH32 串口 ISP 识别失败（请确认已进入 ISP 模式且选用 WCH 协议）", cause);
    }
  }

  async sync(): Promise<void> {
    /* Handshake / identify 已在 probe 完成 */
  }

  async buildPlan(input: unknown): Promise<FlashPlan> {
    const payload = input as DownloadTaskInput;
    const segments = getFirmwareSegmentsFromTask(payload);
    const app = segments.find((s) => s.slotId === "app") ?? segments[0];
    if (!app) {
      throw this.mkError(
        ErrorCode.FlashPlanInvalid,
        "CH32 Serial 需要有效固件段",
        new Error("Invalid CH32 serial input"),
      );
    }
    return {
      chipFamily: "ch32",
      segments: [{ address: app.address, data: app.data, label: app.label ?? "app" }],
    };
  }

  async erase(plan: FlashPlan): Promise<void> {
    const segment = plan.segments[0];
    try {
      await this.session.eraseCodeFlashForBinaryLength(segment.data.byteLength);
    } catch (cause) {
      throw this.mkError(ErrorCode.EraseFailed, "擦除 CH32 Flash 失败", cause);
    }
  }

  async write(plan: FlashPlan, onProgress: (progress: StageProgress) => void): Promise<void> {
    const segment = plan.segments[0];
    const totalBytes = segment.data.byteLength;
    try {
      await this.session.programCodeFlash(segment.address, segment.data, (written, total) => {
        const percent = total > 0 ? Math.floor((written / total) * 100) : 0;
        onProgress({
          stage: "flashing",
          stagePercent: percent,
          totalPercent: percent,
          bytesWritten: written,
          bytesTotal: totalBytes,
        });
      });
    } catch (cause) {
      if (this.connected) {
        try {
          await this.session.close();
        } catch {
          /* ignore */
        }
      }
      this.connected = false;
      throw this.mkError(ErrorCode.FlashFailed, "写入 CH32 Flash 失败", cause);
    }
  }

  async verify(plan: FlashPlan): Promise<void> {
    const segment = plan.segments[0];
    try {
      await this.session.verifyCodeFlash(segment.address, segment.data, () => {
        /* FlasherProtocol.verify 无进度回调；硬件校验仍执行 */
      });
    } catch (cause) {
      throw this.mkError(ErrorCode.FlashFailed, "校验 CH32 Flash 失败", cause);
    }
  }

  async reset(): Promise<void> {
    if (!this.connected) return;
    await this.session.ispEndReset();
    try {
      await this.session.close();
    } catch (cause) {
      throw this.mkError(ErrorCode.ResetFailed, "断开 CH32 串口失败", cause);
    } finally {
      this.connected = false;
    }
  }
}
