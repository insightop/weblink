// UART ISP implementation for STM32 (AN3155 style).
// Ported from legacy `uart_isp.js` into a typed TS module, without HEX parsing.

const STM32_COMMANDS = {
  GET: 0x00,
  GET_VERSION: 0x01,
  GET_ID: 0x02,
  READ_MEMORY: 0x11,
  GO: 0x21,
  WRITE_MEMORY: 0x31,
  ERASE: 0x43,
  EXTENDED_ERASE: 0x44,
  WRITE_PROTECT: 0x63,
  WRITE_UNPROTECT: 0x73,
  READOUT_PROTECT: 0x82,
  READOUT_UNPROTECT: 0x92,
} as const;

const ACK = 0x79;
const NACK = 0x1f;
const SYNC_BYTE = 0x7f;

export default class UARTISP {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readBuffer: Uint8Array = new Uint8Array(0);
  private abortController: AbortController | null = null;

  async open(port: SerialPort): Promise<void> {
    if (!port.readable || !port.writable) {
      throw new Error("Serial port streams unavailable");
    }
    this.port = port;
    this.reader = port.readable.getReader();
    this.writer = port.writable.getWriter();
  }

  async close(): Promise<void> {
    if (this.reader) {
      await this.reader.cancel().catch(() => undefined);
      this.reader = null;
    }
    if (this.writer) {
      await this.writer.close().catch(() => undefined);
      this.writer = null;
    }
    this.port = null;
    this.readBuffer = new Uint8Array(0);
  }

  private calculateChecksum(data: Uint8Array): number {
    let checksum = 0;
    for (let i = 0; i < data.length; i += 1) checksum ^= data[i];
    return checksum;
  }

  private async sendByte(byte: number): Promise<void> {
    if (!this.writer) throw new Error("Serial writer unavailable");
    await this.writer.write(new Uint8Array([byte]));
  }

  private async sendBytes(bytes: Uint8Array): Promise<void> {
    if (!this.writer) throw new Error("Serial writer unavailable");
    await this.writer.write(bytes);
  }

  private async readByte(timeoutMs = 1000, signal: AbortSignal | null = null): Promise<number> {
    while (this.readBuffer.length === 0) {
      if (signal?.aborted) throw new Error("操作被用户取消");
      if (!this.reader) throw new Error("读取器未初始化或已关闭");

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`读取超时 (${timeoutMs}ms)`)), timeoutMs);
      });

      const readPromise = this.reader.read();

      let result: IteratorResult<Uint8Array>;
      if (signal) {
        const cancelPromise = new Promise<never>((_, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new Error("操作被用户取消")),
            { once: true },
          );
        });
        result = await Promise.race([readPromise, timeoutPromise, cancelPromise]);
      } else {
        result = await Promise.race([readPromise, timeoutPromise]);
      }

      const { value, done } = result;
      if (done) throw new Error("串口连接已断开");

      const newBuffer = new Uint8Array(this.readBuffer.length + value.length);
      newBuffer.set(this.readBuffer);
      newBuffer.set(value, this.readBuffer.length);
      this.readBuffer = newBuffer;
    }

    const byte = this.readBuffer[0];
    this.readBuffer = this.readBuffer.slice(1);
    return byte;
  }

  private async readBytes(count: number, timeoutMs = 1000, signal: AbortSignal | null = null): Promise<Uint8Array> {
    const result = new Uint8Array(count);
    for (let i = 0; i < count; i += 1) {
      result[i] = await this.readByte(timeoutMs, signal);
    }
    return result;
  }

  private async waitForHandshakeResponse(timeoutMs = 1000, signal: AbortSignal | null = null): Promise<void> {
    const response = await this.readByte(timeoutMs, signal);
    if (response === ACK) return;
    if (response === NACK) return;

    const char =
      response >= 32 && response <= 126 ? ` ('${String.fromCharCode(response)}')` : "";
    throw new Error(
      `握手失败，意外的响应: 0x${response.toString(16).padStart(2, "0")}${char}。期望: ACK(0x79) 或 NACK(0x1F)`,
    );
  }

  private async waitForAck(timeoutMs = 1000, signal: AbortSignal | null = null): Promise<void> {
    const response = await this.readByte(timeoutMs, signal);
    if (response === ACK) return;
    if (response === NACK) throw new Error("收到NACK响应");
    throw new Error(`意外的响应: 0x${response.toString(16).padStart(2, "0")}`);
  }

  private async clearSerialBuffer(): Promise<void> {
    this.readBuffer = new Uint8Array(0);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  async handshake(maxRetries = 10): Promise<void> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        if (!this.port || !this.writer || !this.reader) throw new Error("串口未正确初始化");

        await this.clearSerialBuffer();
        await this.sendByte(SYNC_BYTE);
        await this.waitForHandshakeResponse(1000, signal);

        this.abortController = null;
        return;
      } catch (error) {
        const err = error as Error;
        if (err.message === "操作被用户取消") {
          this.abortController = null;
          throw err;
        }

        if (attempt === maxRetries) {
          this.abortController = null;
          throw new Error(`握手失败，已尝试 ${maxRetries} 次: ${err.message}`);
        }

        if (err.message.includes("断开") || err.message.includes("null")) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    this.abortController = null;
  }

  async getChipId(maxRetries = 10): Promise<Uint8Array> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        await this.clearSerialBuffer();
        await new Promise((resolve) => setTimeout(resolve, 100));

        await this.sendByte(STM32_COMMANDS.GET_ID);
        await this.sendByte(STM32_COMMANDS.GET_ID ^ 0xff);
        await this.waitForAck(1000, signal);

        const length = await this.readByte(1000, signal);
        const idData = await this.readBytes(length + 1, 1000, signal);
        await this.waitForAck(1000, signal);

        this.abortController = null;
        return idData;
      } catch (error) {
        const err = error as Error;
        if (err.message === "操作被用户取消") {
          this.abortController = null;
          throw err;
        }

        if (attempt === maxRetries) {
          this.abortController = null;
          throw new Error(`获取芯片ID失败，已尝试 ${maxRetries} 次: ${err.message}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    this.abortController = null;
    throw new Error("unreachable");
  }

  async eraseAll(): Promise<void> {
    await this.sendByte(STM32_COMMANDS.ERASE);
    await this.sendByte(STM32_COMMANDS.ERASE ^ 0xff);
    await this.waitForAck();

    await this.sendByte(0xff);
    await this.sendByte(0x00); // XOR checksum

    await this.waitForAck(30000);
  }

  private async writeMemory(address: number, data: Uint8Array): Promise<void> {
    if (data.length > 256) throw new Error("单次写入数据不能超过256字节");
    await this.sendByte(STM32_COMMANDS.WRITE_MEMORY);
    await this.sendByte(STM32_COMMANDS.WRITE_MEMORY ^ 0xff);
    await this.waitForAck();

    const addressBytes = new Uint8Array(4);
    addressBytes[0] = (address >> 24) & 0xff;
    addressBytes[1] = (address >> 16) & 0xff;
    addressBytes[2] = (address >> 8) & 0xff;
    addressBytes[3] = address & 0xff;

    const addressChecksum = this.calculateChecksum(addressBytes);
    await this.sendBytes(addressBytes);
    await this.sendByte(addressChecksum);
    await this.waitForAck();

    const dataLength = data.length - 1;
    await this.sendByte(dataLength);
    await this.sendBytes(data);

    const dataWithLength = new Uint8Array(data.length + 1);
    dataWithLength[0] = dataLength;
    dataWithLength.set(data, 1);

    const dataChecksum = this.calculateChecksum(dataWithLength);
    await this.sendByte(dataChecksum);
    await this.waitForAck(5000);
  }

  async downloadBin(
    arrayBuffer: ArrayBuffer,
    baseAddress: number,
    progressCallback: ((written: number, total: number) => void) | null = null,
  ): Promise<void> {
    const data = new Uint8Array(arrayBuffer);
    const totalSize = data.length;
    let bytesWritten = 0;

    const chunkSize = 256;
    for (let offset = 0; offset < totalSize; offset += chunkSize) {
      const remainingBytes = Math.min(chunkSize, totalSize - offset);
      const chunk = data.slice(offset, offset + remainingBytes);
      const currentAddress = baseAddress + offset;

      await this.writeMemory(currentAddress, chunk);
      bytesWritten += remainingBytes;
      progressCallback?.(bytesWritten, totalSize);

      if (offset % (chunkSize * 2) === 0) {
        await new Promise((resolve) => {
          requestAnimationFrame(() => setTimeout(resolve, 5));
        });
      }
    }
  }
}

