import { toSerialUserError, type SerialUserError } from "./serialErrors";

export type ConnectionState = "idle" | "connected" | "disconnected";

export type SerialDataHandler = (chunk: Uint8Array) => void;
export type SerialStatusHandler = (state: ConnectionState) => void;
export type SerialErrorHandler = (error: SerialUserError) => void;

export class SerialSession {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

  private state: ConnectionState = "idle";
  private onDataHandlers = new Set<SerialDataHandler>();
  private onStatusHandlers = new Set<SerialStatusHandler>();
  private onErrorHandlers = new Set<SerialErrorHandler>();

  private readLoopRunning = false;
  private writeChain: Promise<void> = Promise.resolve();

  get connectionState(): ConnectionState {
    return this.state;
  }

  get activePort(): SerialPort | null {
    return this.port;
  }

  onData(cb: SerialDataHandler): () => void {
    this.onDataHandlers.add(cb);
    return () => this.onDataHandlers.delete(cb);
  }

  onStatus(cb: SerialStatusHandler): () => void {
    this.onStatusHandlers.add(cb);
    return () => this.onStatusHandlers.delete(cb);
  }

  onError(cb: SerialErrorHandler): () => void {
    this.onErrorHandlers.add(cb);
    return () => this.onErrorHandlers.delete(cb);
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    for (const cb of this.onStatusHandlers) cb(next);
  }

  private emitData(chunk: Uint8Array): void {
    for (const cb of this.onDataHandlers) cb(chunk);
  }

  private emitError(err: SerialUserError): void {
    for (const cb of this.onErrorHandlers) cb(err);
  }

  async open(port: SerialPort, options: SerialOptions): Promise<void> {
    await this.close();
    this.port = port;
    try {
      await port.open(options);
      this.reader = port.readable?.getReader() ?? null;
      this.writer = port.writable?.getWriter() ?? null;
      this.setState("connected");
      this.startReadLoop();
    } catch (e) {
      const err = toSerialUserError(e, { code: "open_failed", message: "串口打开失败。" });
      this.emitError(err);
      await this.close();
      throw err;
    }
  }

  async close(): Promise<void> {
    this.readLoopRunning = false;

    const reader = this.reader;
    this.reader = null;
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
    }

    const writer = this.writer;
    this.writer = null;
    if (writer) {
      try {
        writer.releaseLock();
      } catch {
        // ignore
      }
    }

    const port = this.port;
    this.port = null;
    if (port) {
      try {
        await port.close();
      } catch {
        // ignore
      }
    }

    this.setState("disconnected");
  }

  async write(bytes: Uint8Array): Promise<void> {
    const writer = this.writer;
    if (!writer) {
      const err: SerialUserError = { code: "write_failed", message: "未连接串口，无法发送。" };
      this.emitError(err);
      throw err;
    }

    // 保证写入顺序：将写入串到单个 promise 链
    this.writeChain = this.writeChain.then(async () => {
      try {
        await writer.write(bytes);
      } catch (e) {
        const err = toSerialUserError(e, { code: "write_failed", message: "串口写入失败。" });
        this.emitError(err);
        throw err;
      }
    });

    return this.writeChain;
  }

  private startReadLoop(): void {
    if (this.readLoopRunning) return;
    this.readLoopRunning = true;

    const loop = async (): Promise<void> => {
      const reader = this.reader;
      if (!reader) return;

      try {
        while (this.readLoopRunning) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value && value.length > 0) {
            this.emitData(value);
          }
        }
      } catch (e) {
        const err = toSerialUserError(e, { code: "read_failed", message: "串口读取失败。" });
        this.emitError(err);
      } finally {
        if (this.readLoopRunning) {
          this.readLoopRunning = false;
          this.setState("disconnected");
        }
      }
    };

    void loop();
  }
}
