import type { SerialSignals, SerialTransport } from "../types";

export class WebSerialTransport implements SerialTransport {
  readonly name = "web-serial";
  private _port: SerialPort | null = null;
  // Do not hold reader/writer locks here.
  // Protocol implementations (e.g. UARTISP) may need to lock the stream too.
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

  private _disconnectCallback: (() => void) | null = null;
  private _reconnectCallback: (() => void) | null = null;
  /** 护板标志：close() / cancel() 等主动操作期间跳过 I/O 断开检测。 */
  private _intentionalClose = false;

  constructor(private readonly baudRate = 115200) {}

  /** 获取底层 SerialPort 引用（供 ReconnectManager 使用）。 */
  get port(): SerialPort | null {
    return this._port;
  }

  onDisconnect(cb: () => void): void {
    this._disconnectCallback = cb;
  }

  onReconnect(cb: () => void): void {
    this._reconnectCallback = cb;
  }

  removeEventListeners(): void {
    this._disconnectCallback = null;
    this._reconnectCallback = null;
  }

  /** 替换底层端口引用，供 ReconnectManager 在设备重连后调用。 */
  replacePort(newPort: SerialPort): void {
    this._port = newPort;
  }

  /** 触发断开回调，供 ReconnectManager 调用。 */
  notifyDisconnect(): void {
    this._disconnectCallback?.();
  }

  /** 触发重连回调，供 ReconnectManager 调用。 */
  notifyReconnect(): void {
    this._reconnectCallback?.();
  }

  async selectDevice(): Promise<void> {
    if (!("serial" in navigator)) throw new Error("WebSerial is not supported");
    const serialApi = navigator.serial as Serial;
    this._port = await serialApi.requestPort();
  }

  isDeviceReady(): boolean {
    return Boolean(this._port);
  }

  getDeviceLabel(): string | null {
    if (!this._port) return null;
    const info = this._port.getInfo?.();
    if (!info) return "Serial device";
    const vendor = typeof info.usbVendorId === "number" ? info.usbVendorId.toString(16) : "unknown";
    const product = typeof info.usbProductId === "number" ? info.usbProductId.toString(16) : "unknown";
    return `Serial ${vendor}:${product}`;
  }

  getDeviceDetails(): string[] {
    if (!this._port) return [];
    const info = this._port.getInfo?.();
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
    if (!this._port) {
      await this.selectDevice();
    }
    if (!this._port) throw new Error("Serial port is not selected");
    if (this._port.readable && this._port.writable) return;
    await this._port.open({ baudRate: this.baudRate });
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
    this._intentionalClose = true;
    this.removeEventListeners();
    await this.releaseSession();
    await this._port?.close().catch(() => undefined);
    this._port = null;
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this._port) throw new Error("Serial port is not opened");
    if (!this._port.writable) throw new Error("Serial writable stream unavailable");
    const writer = this._port.writable.getWriter();
    try {
      await writer.write(data);
    } catch (e) {
      // 串口流写入失败 → 设备可能已断开（这是最可靠的 I/O 级检测路径）
      if (!this._intentionalClose) this.notifyDisconnect();
      throw e;
    } finally {
      writer.releaseLock();
    }
  }

  async read(size: number, timeoutMs = 1000): Promise<Uint8Array> {
    if (!this._port) throw new Error("Serial port is not opened");
    if (!this._port.readable) {
      if (!this._intentionalClose) this.notifyDisconnect();
      throw new Error("Serial readable stream unavailable");
    }
    const reader = this._port.readable.getReader();
    const deadline = Date.now() + timeoutMs;
    const chunks: number[] = [];
    try {
      while (chunks.length < size) {
        if (Date.now() > deadline) throw new Error("Serial read timeout");
        const result = await reader.read();
        if (result.done) {
          // 流已关闭 → 设备断开
          if (!this._intentionalClose) this.notifyDisconnect();
          throw new Error("Serial closed");
        }
        if (result.value) chunks.push(...result.value);
      }
      return Uint8Array.from(chunks.slice(0, size));
    } catch (e) {
      // 非超时错误也可能是断开的信号
      if (!this._intentionalClose && e instanceof Error && e.message !== "Serial read timeout") {
        this.notifyDisconnect();
      }
      throw e;
    } finally {
      reader.releaseLock();
    }
  }

  async cancel(): Promise<void> {
    this._intentionalClose = true;
    await this.reader?.cancel().catch(() => undefined);
  }

  getPort(): SerialPort {
    if (!this._port) throw new Error("Serial port is not opened");
    return this._port;
  }

  async setSignals(signals: SerialSignals): Promise<void> {
    if (!this._port) throw new Error("Serial port is not opened");
    await this._port.setSignals(signals);
  }
}
