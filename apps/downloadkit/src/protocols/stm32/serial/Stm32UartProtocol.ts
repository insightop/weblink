import UARTISP from "./UartIsp";
import { getFirmwareSegmentsFromTask } from "@/core/firmware/normalizeFirmwareToSegments";
import type { DownloadTaskInput, FlashPlan, StageProgress } from "@/core/types/download";
import { ErrorCode, type DownloadError } from "@/core/errors/ErrorCode";
import type { FlasherProtocol, ProbeResult } from "@/protocols/types";
import type { SerialTransport } from "@/transports/types";

export class Stm32UartProtocol implements FlasherProtocol {
  private readonly uart = new UARTISP();
  private connected = false;
  private chipLabel = "STM32-UART";

  constructor(private readonly transport: SerialTransport) {}

  private mkError(code: ErrorCode, userMessage: string, cause: unknown): DownloadError {
    const debugMessage = cause instanceof Error ? cause.message : String(cause);
    return { code, userMessage, debugMessage, cause };
  }

  async probe(): Promise<ProbeResult> {
    try {
      if (!this.connected) {
        await this.uart.open(this.transport.getPort());
        this.connected = true;
      }
      await this.uart.handshake();
      const id = await this.uart.getChipId(10);
      const idHex = Array.from(id)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      this.chipLabel = `STM32-${idHex}`;
      return { chipFamily: "stm32", chipName: this.chipLabel };
    } catch (cause) {
      if (this.connected) {
        try {
          await this.uart.close();
        } catch {
          /* ignore */
        }
      }
      this.connected = false;
      throw this.mkError(ErrorCode.ProbeFailed, "串口握手/读取芯片信息失败", cause);
    }
  }

  async sync(): Promise<void> {
    // Handshake already happens during probe.
  }

  async buildPlan(input: unknown): Promise<FlashPlan> {
    const payload = input as DownloadTaskInput;
    const segments = getFirmwareSegmentsFromTask(payload);
    const app = segments.find((s) => s.slotId === "app") ?? segments[0];
    if (!app) {
      throw this.mkError(
        ErrorCode.FlashPlanInvalid,
        "STM32 Serial 需要有效固件段",
        new Error("Invalid STM32 serial input"),
      );
    }
    return {
      chipFamily: "stm32",
      segments: [{ address: app.address, data: app.data, label: app.label ?? "app" }],
    };
  }

  async erase(): Promise<void> {
    try {
      await this.uart.eraseAll();
    } catch (cause) {
      throw this.mkError(ErrorCode.EraseFailed, "擦除 Flash 失败", cause);
    }
  }

  async write(plan: FlashPlan, onProgress: (progress: StageProgress) => void): Promise<void> {
    const segment = plan.segments[0];
    const totalBytes = segment.data.byteLength;
    const arrayBuffer = segment.data.buffer.slice(
      segment.data.byteOffset,
      segment.data.byteOffset + segment.data.byteLength,
    ) as ArrayBuffer;
    try {
      await this.uart.downloadBin(arrayBuffer, segment.address, (written, total) => {
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
          await this.uart.close();
        } catch {
          /* ignore */
        }
      }
      this.connected = false;
      throw this.mkError(ErrorCode.FlashFailed, "写入 Flash 失败", cause);
    }
  }

  async verify(): Promise<void> {}

  async reset(): Promise<void> {
    if (this.connected) {
      try {
        await this.uart.close();
        this.connected = false;
      } catch (cause) {
        this.connected = false;
        throw this.mkError(ErrorCode.ResetFailed, "复位/断开串口失败", cause);
      }
    }
  }
}
