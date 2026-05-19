import { ErrorCode, type DownloadError } from "@/core/errors/ErrorCode";
import type { FlashPlan } from "@/core/types/download";
import { loadEsptool } from "@/protocols/esp32/esptool/loadEsptool";
import type { SerialTransport } from "@/transports/types";
import type { FlashOptions, IEspLoaderTerminal } from "esptool-js";
import { i18n } from "@/i18n";
import type { ESPLoader, Transport as EspTransport } from "esptool-js";

export interface EspChipInfo {
  chipName: string;
}

export interface EsptoolJsAdapterOptions {
  /** Forwarded to esptool-js ESPLoader `debugLogging` (verbose console). */
  debugLogging?: boolean;
}

const QUIET_TERMINAL: IEspLoaderTerminal = {
  clean: () => undefined,
  write: () => undefined,
  writeLine: () => undefined,
};

function t(key: string): string {
  return String(i18n.global.t(key));
}

function toDownloadError(code: ErrorCode, messageKey: string, cause: unknown): DownloadError {
  return {
    code,
    userMessage: t(messageKey),
    debugMessage: cause instanceof Error ? cause.message : String(cause),
    cause,
  };
}

/**
 * ESP32 + Web Serial 契约（与 esptool-js 一致）：
 * - `WebSerialTransport` 只负责 **选口**（`selectDevice` / `requestPort`，须在用户手势下完成）。
 * - `DownloadSession` 对 ESP32 **不在 probe 前** 调用 `transport.open()`（见 `defersTransportOpen`），
 *   避免与 esptool-js 的 `Transport.connect()`（内部 `SerialPort.open`）重复打开同一端口。
 * - `ESPLoader.main()` 会调用 `transport.connect(baudrate)`；`baudrate` 须与插件配置一致。
 */
export class EsptoolJsAdapter {
  private transportImpl: EspTransport | null = null;
  private loader: ESPLoader | null = null;

  constructor(
    private readonly transport: SerialTransport,
    private readonly options: EsptoolJsAdapterOptions = {},
  ) {}

  async connect(baudrate: number): Promise<EspChipInfo> {
    try {
      const { ESPLoader, Transport } = await loadEsptool();
      const port = this.transport.getPort();
      this.transportImpl = new Transport(port, false);
      this.loader = new ESPLoader({
        transport: this.transportImpl,
        baudrate,
        terminal: QUIET_TERMINAL,
        debugLogging: Boolean(this.options.debugLogging),
      });
      const chipName = await this.loader.main();
      return { chipName };
    } catch (cause) {
      throw toDownloadError(ErrorCode.ProbeFailed, "esp.probeFailed", cause);
    }
  }

  async writeFlash(plan: FlashPlan, onProgress: (writtenBytes: number, totalBytes: number) => void): Promise<void> {
    if (!this.loader) {
      throw toDownloadError(ErrorCode.ConnectionFailed, "esp.connectionFailed", new Error("Loader unavailable"));
    }
    const bytesTotal = plan.segments.reduce((sum, segment) => sum + segment.data.byteLength, 0);
    const segmentTotals = plan.segments.map((segment) => segment.data.byteLength);
    const finishedPrefix = segmentTotals.map((_, idx) =>
      segmentTotals.slice(0, idx).reduce((sum, value) => sum + value, 0),
    );
    const flashOptions: FlashOptions = {
      fileArray: plan.segments.map((segment) => ({ data: segment.data, address: segment.address })),
      flashMode: "keep",
      flashFreq: "keep",
      flashSize: "keep",
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex, written, total) => {
        const normalizedWritten = total > 0 ? Math.min(total, written) : 0;
        const globalWritten = (finishedPrefix[fileIndex] ?? 0) + normalizedWritten;
        onProgress(globalWritten, bytesTotal);
      },
    };
    try {
      await this.loader.writeFlash(flashOptions);
      onProgress(bytesTotal, bytesTotal);
    } catch (cause) {
      throw toDownloadError(ErrorCode.FlashFailed, "esp.flashFailed", cause);
    }
  }

  async reset(): Promise<void> {
    if (!this.loader) return;
    try {
      await this.loader.after("hard_reset");
    } catch (cause) {
      throw toDownloadError(ErrorCode.ResetFailed, "esp.resetFailed", cause);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.transport.close();
    } finally {
      this.loader = null;
      this.transportImpl = null;
    }
  }
}
