import type { RxFrameRow } from "@/domain/can/types.js";
import { CanKitError } from "@/domain/errors/can-kit-error.js";
import {
  buildBitrateCommand,
  buildCloseCommand,
  buildOpenCommand,
  DEFAULT_LINE_ENDING,
  type LineEnding,
} from "@/domain/slcan/slcan-commands.js";
import { encodeTransmitLine, tryDecodeDataFrameLine } from "@/domain/slcan/slcan-codec.js";
import { iterateLinesFromUtf8Stream } from "@/infrastructure/serial/line-reader.js";
import {
  assertSerialSupported,
  WebSerialTransport,
} from "@/infrastructure/serial/web-serial-transport.js";
import { logDebug } from "@/shared/logger.js";
import type { ConnectOptions, SessionEvent } from "./can-session.types.js";

/** Web Serial + slcan 文本协议会话 */
export class SlcanCanSession {
  private readonly transport = new WebSerialTransport();
  private readonly lineEnding: string;
  private seq = 0;
  private stopRead = false;
  private readLoopDone: Promise<void> = Promise.resolve();

  private emit: (ev: SessionEvent) => void;

  constructor(
    emit: (ev: SessionEvent) => void,
    options?: { lineEnding?: LineEnding },
  ) {
    this.emit = emit;
    this.lineEnding = options?.lineEnding ?? DEFAULT_LINE_ENDING;
  }

  get connected(): boolean {
    return this.transport.isOpen();
  }

  async requestPort(): Promise<SerialPort> {
    assertSerialSupported();
    try {
      return await navigator.serial.requestPort();
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotFoundError") {
        throw new CanKitError("USER_CANCELLED", "未选择串口", { cause: e });
      }
      throw new CanKitError("PORT_OPEN_FAILED", "选择串口失败", { cause: e });
    }
  }

  async connect(port: SerialPort, opts: ConnectOptions): Promise<void> {
    this.stopRead = false;
    this.seq = 0;
    const readable = await this.transport.open(port, { baudRate: opts.baudRate });
    const ending = this.lineEnding as LineEnding;

    if (opts.canBitrate != null) {
      const br = buildBitrateCommand(opts.canBitrate, ending);
      if (br) await this.transport.writeText(br);
    }
    await this.transport.writeText(buildOpenCommand(ending));

    this.readLoopDone = this.runReadLoop(readable);
  }

  private async runReadLoop(readable: ReadableStream<Uint8Array>): Promise<void> {
    try {
      for await (const line of iterateLinesFromUtf8Stream(readable)) {
        if (this.stopRead) break;
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const frame = tryDecodeDataFrameLine(trimmed);
          if (!frame) continue;
          this.seq += 1;
          const row: RxFrameRow = {
            seq: this.seq,
            ts: performance.now(),
            frame,
          };
          this.emit({ type: "rx", row });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.emit({ type: "parse_error", line: trimmed, message: msg });
          logDebug("slcan parse", trimmed, msg);
        }
      }
    } catch (e) {
      this.emit({ type: "read_error", error: e });
    }
  }

  async sendFrame(payload: {
    id: number;
    extended: boolean;
    dlc: number;
    data: Uint8Array;
  }): Promise<void> {
    const line = encodeTransmitLine(payload) + this.lineEnding;
    await this.transport.writeText(line);
  }

  async disconnect(): Promise<void> {
    this.stopRead = true;
    try {
      if (this.transport.isOpen()) {
        await this.transport.writeText(
          buildCloseCommand(this.lineEnding as LineEnding),
        );
      }
    } catch {
      /* ignore */
    }
    await this.transport.close();
    await this.readLoopDone.catch(() => undefined);
  }
}
