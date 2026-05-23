import { CanKitError } from "../../domain/errors/can-kit-error.js";

export function assertSerialSupported(): void {
  if (typeof navigator === "undefined" || !("serial" in navigator)) {
    throw new CanKitError(
      "SERIAL_UNSUPPORTED",
      "当前浏览器不支持 Web Serial（请使用 Chrome / Edge 等 Chromium 内核，并确保 HTTPS 或 localhost）。",
    );
  }
}

export class WebSerialTransport {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readonly encoder = new TextEncoder();
  private writeTail = Promise.resolve();

  getPort(): SerialPort | null {
    return this.port;
  }

  isOpen(): boolean {
    return this.port != null && this.writer != null;
  }

  async open(port: SerialPort, options: { baudRate: number }): Promise<ReadableStream<Uint8Array>> {
    try {
      await port.open({ baudRate: options.baudRate });
    } catch (e) {
      throw new CanKitError("PORT_OPEN_FAILED", "无法打开串口", { cause: e });
    }
    if (!port.readable || !port.writable) {
      await port.close().catch(() => undefined);
      throw new CanKitError("PORT_OPEN_FAILED", "串口缺少可读或可写端点");
    }
    this.port = port;
    this.writer = port.writable.getWriter();
    return port.readable;
  }

  /** 串行写入，避免并发 write 交错 */
  writeText(text: string): Promise<void> {
    const w = this.writer;
    if (!w) {
      return Promise.reject(new CanKitError("PORT_NOT_OPEN", "串口未打开"));
    }
    const chunk = this.encoder.encode(text);
    this.writeTail = this.writeTail.then(() => w.write(chunk));
    return this.writeTail;
  }

  async close(): Promise<void> {
    const w = this.writer;
    this.writer = null;
    const p = this.port;
    this.port = null;
    await this.writeTail.catch(() => undefined);
    if (w) {
      try {
        await w.close();
      } catch {
        /* ignore */
      }
    }
    if (p?.readable?.locked) {
      try {
        await p.readable.cancel();
      } catch {
        /* ignore */
      }
    }
    if (p) {
      try {
        await p.close();
      } catch {
        /* ignore */
      }
    }
  }
}
