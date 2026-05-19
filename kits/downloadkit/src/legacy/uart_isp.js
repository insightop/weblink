// DEPRECATED:
// Legacy UART ISP implementation (HTML+JS era). The Vue app's `stm32-serial`
// protocol uses `src/protocols/stm32/serial/UartIsp.ts` instead.

// stm32f1_isp.js
// 适用于STM32F1官方串口ISP协议（AN3155），通过Web Serial API

// STM32 USART bootloader commands (AN3155 Table 2)
const STM32_COMMANDS = {
  GET: 0x00, // Gets the version and the allowed commands supported by the current version of the bootloader
  GET_VERSION: 0x01, // Gets the bootloader version and the Read Protection status of the Flash memory
  GET_ID: 0x02, // Gets the chip ID
  READ_MEMORY: 0x11, // Reads up to 256 bytes of memory starting from an address specified by the application
  GO: 0x21, // Jumps to user application code located in the internal Flash memory or in SRAM
  WRITE_MEMORY: 0x31, // Writes up to 256 bytes to the RAM or Flash memory starting from an address specified by the application
  ERASE: 0x43, // Erases from one to all the Flash memory pages
  EXTENDED_ERASE: 0x44, // Erases from one to all the Flash memory pages using two byte addressing mode (available only for v3.0 uart bootloader versions and above)
  WRITE_PROTECT: 0x63, // Enables the write protection for some sectors
  WRITE_UNPROTECT: 0x73, // Disables the write protection for all Flash memory sectors
  READOUT_PROTECT: 0x82, // Enables the read protection
  READOUT_UNPROTECT: 0x92, // Disables the read protection
};

// 响应字节
const ACK = 0x79;
const NACK = 0x1f;

// 握手字节
const SYNC_BYTE = 0x7f;

export default class UARTISP {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.readBuffer = new Uint8Array(0);
    this.abortController = null;
  }

  async open(port) {
    this.port = port;
    this.reader = port.readable.getReader();
    this.writer = port.writable.getWriter();
  }

  async close() {
    if (this.reader) {
      await this.reader.cancel();
      this.reader = null;
    }
    if (this.writer) {
      await this.writer.close();
      this.writer = null;
    }
    this.port = null;
    this.readBuffer = new Uint8Array(0);
  }

  // 计算XOR校验和
  calculateChecksum(data) {
    let checksum = 0;
    for (let i = 0; i < data.length; i++) {
      checksum ^= data[i];
    }
    return checksum;
  }

  // 发送字节
  async sendByte(byte) {
    const data = new Uint8Array([byte]);
    await this.writer.write(data);
  }

  // 发送字节数组
  async sendBytes(bytes) {
    await this.writer.write(bytes);
  }

  // 读取单个字节，带超时和中断支持
  async readByte(timeoutMs = 1000, signal = null) {
    const startTime = Date.now();

    while (this.readBuffer.length === 0) {
      if (signal && signal.aborted) {
        throw new Error("操作被用户取消");
      }
      // 检查reader状态
      if (!this.reader) {
        throw new Error("读取器未初始化或已关闭");
      }
      try {
        // 用Promise.race实现超时
        const readPromise = this.reader.read();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => {
            // 不再cancel reader，避免破坏串口流
            reject(new Error(`读取超时 (${timeoutMs}ms)`));
          }, timeoutMs)
        );
        let result;
        if (signal) {
          result = await Promise.race([
            readPromise,
            timeoutPromise,
            new Promise((_, reject) => {
              signal.addEventListener(
                "abort",
                () => reject(new Error("操作被用户取消")),
                { once: true }
              );
            }),
          ]);
        } else {
          result = await Promise.race([readPromise, timeoutPromise]);
        }
        const { value, done } = result;
        if (done) {
          throw new Error("串口连接已断开");
        }
        // 将新数据追加到缓冲区
        const newBuffer = new Uint8Array(this.readBuffer.length + value.length);
        newBuffer.set(this.readBuffer);
        newBuffer.set(value, this.readBuffer.length);
        this.readBuffer = newBuffer;
      } catch (error) {
        if (
          error.message.includes("断开") ||
          error.message === "操作被用户取消"
        ) {
          throw error;
        }
        // 其他读取错误，稍等后重试
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    // 从缓冲区取出一个字节
    const byte = this.readBuffer[0];
    this.readBuffer = this.readBuffer.slice(1);
    return byte;
  }

  // 读取指定数量的字节，支持signal
  async readBytes(count, timeoutMs = 1000, signal = null) {
    const result = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = await this.readByte(timeoutMs, signal);
    }
    return result;
  }

  // 等待握手响应 (ACK或NACK都算成功)，支持signal
  async waitForHandshakeResponse(timeoutMs = 1000, signal = null) {
    try {
      const response = await this.readByte(timeoutMs, signal);
      if (response === ACK) {
        console.log("收到ACK响应，握手成功");
        return true;
      } else if (response === NACK) {
        console.log("收到NACK响应，设备可能已在ISP模式，握手成功");
        return true;
      } else {
        const char =
          response >= 32 && response <= 126
            ? ` ('${String.fromCharCode(response)}')`
            : "";
        throw new Error(
          `握手失败，意外的响应: 0x${response
            .toString(16)
            .padStart(2, "0")}${char}。期望: ACK(0x79) 或 NACK(0x1F)`
        );
      }
    } catch (error) {
      if (error.message.includes("读取超时")) {
        throw new Error(
          `握手超时：${timeoutMs}ms 内未收到设备响应。请检查设备是否已进入ISP模式`
        );
      }
      throw error;
    }
  }

  // 等待ACK响应，支持signal
  async waitForAck(timeoutMs = 1000, signal = null) {
    const response = await this.readByte(timeoutMs, signal);
    if (response === ACK) {
      return true;
    } else if (response === NACK) {
      throw new Error("收到NACK响应");
    } else {
      throw new Error(
        `意外的响应: 0x${response.toString(16).padStart(2, "0")}`
      );
    }
  }

  // 清理串口缓冲区，简单清空内部缓冲区
  async clearSerialBuffer() {
    console.log("清理串口缓冲区...");
    this.readBuffer = new Uint8Array(0);
    // 简单等待一小段时间，让可能的残留数据有时间到达
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // 新增：外部调用终止当前操作
  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // ISP握手，支持多次尝试和中断
  async handshake(maxRetries = 10) {
    console.log(`开始ISP握手，最多尝试 ${maxRetries} 次...`);
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`握手尝试 ${attempt}/${maxRetries}`);
        if (!this.port || !this.writer || !this.reader) {
          throw new Error("串口未正确初始化");
        }
        await this.clearSerialBuffer();
        console.log(`发送同步字节: 0x${SYNC_BYTE.toString(16).toUpperCase()}`);
        await this.sendByte(SYNC_BYTE);
        console.log("同步字节已发送，等待设备响应...");
        await this.waitForHandshakeResponse(1000, signal);
        console.log(`握手成功 (尝试 ${attempt}/${maxRetries})`);
        this.abortController = null;
        return;
      } catch (error) {
        if (error.message === "操作被用户取消") {
          this.abortController = null;
          throw error;
        }
        console.log(`握手尝试 ${attempt} 失败: ${error.message}`);
        if (attempt === maxRetries) {
          this.abortController = null;
          throw new Error(
            `握手失败，已尝试 ${maxRetries} 次: ${error.message}`
          );
        }
        // 遇到串口断开或null也继续重试，只有最后一次才终止
        if (error.message.includes("断开") || error.message.includes("null")) {
          console.log(`串口断开，等待500ms后重试...`);
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        console.log(`等待 ${500} ms 后重试...`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    this.abortController = null;
  }

  // 获取芯片ID，支持多次尝试和中断
  async getChipId(maxRetries = 10) {
    console.log(`获取芯片ID，最多尝试 ${maxRetries} 次...`);
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`获取ID尝试 ${attempt}/${maxRetries}`);
        // 每次尝试前清理串口缓冲区并延时，提升兼容性
        await this.clearSerialBuffer();
        await new Promise((resolve) => setTimeout(resolve, 100));
        await this.sendByte(STM32_COMMANDS.GET_ID);
        await this.sendByte(STM32_COMMANDS.GET_ID ^ 0xff);
        await this.waitForAck(1000, signal);
        const length = await this.readByte(1000, signal);
        console.log(`ID数据长度: ${length + 1} 字节`);
        const idData = await this.readBytes(length + 1, 1000, signal);
        await this.waitForAck(1000, signal);
        console.log(`芯片ID获取成功 (尝试 ${attempt}/${maxRetries})`);
        this.abortController = null;
        return idData;
      } catch (error) {
        if (error.message === "操作被用户取消") {
          this.abortController = null;
          throw error;
        }
        console.log(`获取ID尝试 ${attempt} 失败: ${error.message}`);
        if (attempt === maxRetries) {
          this.abortController = null;
          throw new Error(
            `获取芯片ID失败，已尝试 ${maxRetries} 次: ${error.message}`
          );
        }
        // NACK、串口断开等都自动重试，只有最后一次才报错
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
    }
    this.abortController = null;
  }

  // 全擦除Flash
  async eraseAll() {
    console.log("开始全擦除Flash...");

    // 发送ERASE命令
    await this.sendByte(STM32_COMMANDS.ERASE);
    await this.sendByte(STM32_COMMANDS.ERASE ^ 0xff);

    // 等待ACK
    await this.waitForAck();

    // 发送全擦除参数 (0xFF表示全擦除)
    await this.sendByte(0xff);
    await this.sendByte(0x00); // XOR校验

    // 等待擦除完成 (全擦除需要更长时间)
    await this.waitForAck(30000); // 30秒超时，擦除操作需要较长时间

    console.log("Flash全擦除完成");
  }

  // 写入内存
  async writeMemory(address, data) {
    console.log(
      `写入内存地址: 0x${address.toString(16).toUpperCase()}, 大小: ${
        data.length
      } 字节`
    );

    if (data.length > 256) {
      throw new Error("单次写入数据不能超过256字节");
    }

    // 发送WRITE_MEMORY命令
    await this.sendByte(STM32_COMMANDS.WRITE_MEMORY);
    await this.sendByte(STM32_COMMANDS.WRITE_MEMORY ^ 0xff);

    // 等待ACK
    await this.waitForAck();

    // 发送地址 (大端格式)
    const addressBytes = new Uint8Array(4);
    addressBytes[0] = (address >> 24) & 0xff;
    addressBytes[1] = (address >> 16) & 0xff;
    addressBytes[2] = (address >> 8) & 0xff;
    addressBytes[3] = address & 0xff;

    const addressChecksum = this.calculateChecksum(addressBytes);
    await this.sendBytes(addressBytes);
    await this.sendByte(addressChecksum);

    // 等待ACK
    await this.waitForAck();

    // 发送数据长度 (N-1格式)
    const dataLength = data.length - 1;
    await this.sendByte(dataLength);

    // 发送数据
    await this.sendBytes(data);

    // 计算并发送校验和
    const dataWithLength = new Uint8Array(data.length + 1);
    dataWithLength[0] = dataLength;
    dataWithLength.set(data, 1);
    const dataChecksum = this.calculateChecksum(dataWithLength);
    await this.sendByte(dataChecksum);

    // 等待ACK
    await this.waitForAck(5000); // 写入Flash需要更长时间，保持5秒超时
  }

  // 下载二进制数据
  async downloadBin(arrayBuffer, baseAddress, progressCallback = null) {
    const data = new Uint8Array(arrayBuffer);
    const totalSize = data.length;
    console.log(
      `开始下载固件，总大小: ${totalSize} 字节，基地址: 0x${baseAddress
        .toString(16)
        .toUpperCase()}`
    );

    let bytesWritten = 0;
    const chunkSize = 256; // STM32 bootloader每次最多写入256字节

    for (let offset = 0; offset < totalSize; offset += chunkSize) {
      const remainingBytes = Math.min(chunkSize, totalSize - offset);
      const chunk = data.slice(offset, offset + remainingBytes);
      const currentAddress = baseAddress + offset;

      await this.writeMemory(currentAddress, chunk);

      bytesWritten += remainingBytes;

      if (progressCallback) {
        progressCallback(bytesWritten, totalSize);
      }

      // 每写入几个块后暂停一小段时间，避免过快，并让出控制权给UI
      if (offset % (chunkSize * 2) === 0) {
        await new Promise((resolve) => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 5);
          });
        });
      }
    }

    console.log(`固件下载完成，共写入 ${bytesWritten} 字节`);
  }
}

// HEX文件解析函数
export async function hexToBin(hexFilePath) {
  try {
    const response = await fetch(hexFilePath);
    const hexContent = await response.text();

    const lines = hexContent
      .split("\n")
      .filter((line) => line.trim().startsWith(":"));

    let minAddress = 0xffffffff;
    let maxAddress = 0;
    const dataMap = new Map();
    let extendedLinearAddress = 0; // 扩展线性地址 (类型04)
    let extendedSegmentAddress = 0; // 扩展段地址 (类型02)

    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine.length < 11) continue;

      const dataLength = parseInt(cleanLine.substr(1, 2), 16);
      const address = parseInt(cleanLine.substr(3, 4), 16);
      const recordType = parseInt(cleanLine.substr(7, 2), 16);

      switch (recordType) {
        case 0x00: {
          // 数据记录
          const baseAddress =
            (extendedLinearAddress << 16) + (extendedSegmentAddress << 4);
          for (let i = 0; i < dataLength; i++) {
            const byteData = parseInt(cleanLine.substr(9 + i * 2, 2), 16);
            const fullAddress = baseAddress + address + i;
            dataMap.set(fullAddress, byteData);

            minAddress = Math.min(minAddress, fullAddress);
            maxAddress = Math.max(maxAddress, fullAddress);
          }
          break;
        }
        case 0x01:
          // 文件结束记录
          break;
        case 0x02:
          // 扩展段地址记录
          if (dataLength === 2) {
            const segmentData = cleanLine.substr(9, 4);
            extendedSegmentAddress = parseInt(segmentData, 16);
            console.log(
              `扩展段地址: 0x${extendedSegmentAddress
                .toString(16)
                .toUpperCase()}`
            );
          }
          break;
        case 0x04:
          // 扩展线性地址记录
          if (dataLength === 2) {
            const linearData = cleanLine.substr(9, 4);
            extendedLinearAddress = parseInt(linearData, 16);
            console.log(
              `扩展线性地址: 0x${extendedLinearAddress
                .toString(16)
                .toUpperCase()}`
            );
          }
          break;
        case 0x05:
          // 启动线性地址记录
          break;
        default:
          console.log(
            `未知记录类型: 0x${recordType.toString(16).padStart(2, "0")}`
          );
          break;
      }
    }

    if (dataMap.size === 0) {
      throw new Error("HEX文件中没有找到有效数据");
    }

    const totalSize = maxAddress - minAddress + 1;
    const arrayBuffer = new ArrayBuffer(totalSize);
    const uint8Array = new Uint8Array(arrayBuffer);

    // 默认填充0xFF
    uint8Array.fill(0xff);

    // 填入实际数据
    for (const [address, data] of dataMap) {
      uint8Array[address - minAddress] = data;
    }

    console.log(`HEX文件解析完成:`);
    console.log(`  基地址: 0x${minAddress.toString(16).toUpperCase()}`);
    console.log(`  大小: ${totalSize} 字节`);
    console.log(
      `  地址范围: 0x${minAddress.toString(16).toUpperCase()} - 0x${maxAddress
        .toString(16)
        .toUpperCase()}`
    );

    return {
      arrayBuffer,
      baseAddr: minAddress,
      size: totalSize,
    };
  } catch (error) {
    throw new Error(`HEX文件解析失败: ${error.message}`);
  }
}
