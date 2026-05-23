import type { SerialSignals, SerialTransport } from "../types";

export class WebSerialTransport implements SerialTransport {
  readonly name = "web-serial";
  private port: SerialPort | null = null;
  // Do not hold reader/writer locks here.
  // Protocol implementations (e.g. UARTISP) may need to lock the stream too.
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

  constructor(private readonly baudRate = 115200) {}

  async selectDevice(): Promise<void> {
    if (!("serial" in navigator)) throw new Error("WebSerial is not supported");
    const serialApi = navigator.serial as Serial;
    this.port = await serialApi.requestPort();
  }

  isDeviceReady(): boolean {
    return Boolean(this.port);
  }

  getDeviceLabel(): string | null {
    if (!this.port) return null;
    const info = this.port.getInfo?.();
    if (!info) return "Serial device";
    const vendor = typeof info.usbVendorId === "number" ? info.usbVendorId.toString(16) : "unknown";
    const product = typeof info.usbProductId === "number" ? info.usbProductId.toString(16) : "unknown";
    return `Serial ${vendor}:${product}`;
  }

  getDeviceDetails(): string[] {
    if (!this.port) return [];
    const info = this.port.getInfo?.();
    if (!info) return ["Serial device"];
    const details: string[] = [];
    if (typeof info.usbVendorId === "number") {
      details.push(`VID: 0x${info.usbVendorId.toString(16).padStart(4, "0").toUpperCase()}`);
    }
    if (typeof info.usbProductId === "number") {
      details.push(`PID: 0x${info.usbProductId.toString(16).padStart(4, "0").toUpperCase()}`);
    }
    return details;
  }

  /**
   * 已打开且流可用时直接返回（幂等）。STM32 等协议在会话开始即 open；ESP32（esptool-js）由
   * vendor 在 `probe` 内 `Transport.connect` 打开，会话层可跳过对本方法的首次调用（见
   * `FlasherProtocol.defersTransportOpen`）。
   */
  async open(): Promise<void> {
    if (!this.port) {
      await this.selectDevice();
    }
    if (!this.port) throw new Error("Serial port is not selected");
    if (this.port.readable && this.port.writable) return;
    await this.port.open({ baudRate: this.baudRate });
    // Intentionally do not lock readable/writable here.
  }

  async releaseSession(): Promise<void> {
    await this.reader?.cancel().catch(() => undefined);
    this.reader?.releaseLock();
    this.writer?.releaseLock();
    this.reader = null;
    this.writer = null;
  }

  async close(): Promise<void> {
    await this.releaseSession();
    await this.port?.close().catch(() => undefined);
    this.port = null;
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.port) throw new Error("Serial port is not opened");
    if (!this.port.writable) throw new Error("Serial writable stream unavailable");
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }

  async read(size: number, timeoutMs = 1000): Promise<Uint8Array> {
    if (!this.port) throw new Error("Serial port is not opened");
    if (!this.port.readable) throw new Error("Serial readable stream unavailable");
    const reader = this.port.readable.getReader();
    const deadline = Date.now() + timeoutMs;
    const chunks: number[] = [];
    try {
      while (chunks.length < size) {
        if (Date.now() > deadline) throw new Error("Serial read timeout");
        const result = await reader.read();
        if (result.done) throw new Error("Serial closed");
        if (result.value) chunks.push(...result.value);
      }
      return Uint8Array.from(chunks.slice(0, size));
    } finally {
      reader.releaseLock();
    }
  }

  async cancel(): Promise<void> {
    await this.reader?.cancel().catch(() => undefined);
  }

  getPort(): SerialPort {
    if (!this.port) throw new Error("Serial port is not opened");
    return this.port;
  }

  async setSignals(signals: SerialSignals): Promise<void> {
    if (!this.port) throw new Error("Serial port is not opened");
    await this.port.setSignals(signals);
  }
}
