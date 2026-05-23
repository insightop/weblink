import {
  ch32MinEraseSectorCount,
  ch32UidByteCount,
  findCh32Variant,
  type Ch32ChipVariant,
} from "./ch32ChipCatalog";
import {
  buildErasePacket,
  buildIdentifyPacket,
  buildIspEndPacket,
  buildIspKeyPacket,
  buildProgramPacket,
  buildReadConfigPacket,
  buildVerifyPacket,
  parseWchIspResponseFrame,
  type ParsedWchIspResponse,
  wchIspRequestChecksum,
} from "./wchUartIspFraming";
import {
  WCH_CFG_MASK_ALL,
  WCH_ISP_CHUNK_SIZE,
  WCH_SECTOR_SIZE,
  WCH_UART_REQ_PREFIX,
  WCH_UART_RESP_MAGIC,
} from "./wchUartIspTypes";
import type { SerialTransport } from "../../../transports/types";

const ISP_KEY_SEED_LEN = 0x1e;

function randomU8(): number {
  const a = new Uint8Array(1);
  crypto.getRandomValues(a);
  return a[0];
}

function extendToSectorBoundary(data: Uint8Array): Uint8Array {
  const rem = data.byteLength % WCH_SECTOR_SIZE;
  if (rem === 0) return data;
  const pad = WCH_SECTOR_SIZE - rem;
  const out = new Uint8Array(data.byteLength + pad);
  out.set(data, 0);
  return out;
}

function codeFlashOffsetFromAddress(flashAddress: number): number {
  if (flashAddress >= 0x0800_0000) {
    return flashAddress - 0x0800_0000;
  }
  return flashAddress >>> 0;
}

function xorKeyFromUid(chipUid: Uint8Array, chipId: number): Uint8Array {
  let checksum = 0;
  for (let i = 0; i < chipUid.length; i += 1) {
    checksum = (checksum + chipUid[i]) & 0xff;
  }
  const key = new Uint8Array(8).fill(checksum);
  key[7] = (key[7] + (chipId & 0xff)) & 0xff;
  return key;
}

function xorDataWithKey(data: Uint8Array, key: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 1) {
    out[i] = data[i] ^ key[i % 8];
  }
  return out;
}

/**
 * WCH UART ISP 会话（帧格式参考 ch32-rs/wchisp SerialTransport）。
 */
export class WchUartIspSession {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readBuffer = new Uint8Array(0);
  private chip: Ch32ChipVariant | null = null;
  private chipUid = new Uint8Array(0);

  constructor(private readonly transport: SerialTransport) {}

  get activeChip(): Ch32ChipVariant | null {
    return this.chip;
  }

  async open(): Promise<void> {
    const port = this.transport.getPort();
    if (!port.readable || !port.writable) {
      throw new Error("Serial port streams unavailable");
    }
    this.port = port;
    this.reader = port.readable.getReader();
    this.writer = port.writable.getWriter();
    this.readBuffer = new Uint8Array(0);
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
    this.chip = null;
    this.chipUid = new Uint8Array(0);
  }

  private async readByte(timeoutMs: number): Promise<number> {
    while (this.readBuffer.length === 0) {
      if (!this.reader) throw new Error("Serial reader unavailable");
      const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error(`读取超时 (${timeoutMs}ms)`)), timeoutMs);
      });
      const { value, done } = await Promise.race([this.reader.read(), timeoutPromise]);
      if (done || !value) throw new Error("串口连接已断开");
      const merged = new Uint8Array(this.readBuffer.length + value.length);
      merged.set(this.readBuffer);
      merged.set(value, this.readBuffer.length);
      this.readBuffer = merged;
    }
    const b = this.readBuffer[0];
    this.readBuffer = this.readBuffer.subarray(1);
    return b;
  }

  private async readExact(count: number, timeoutMs: number): Promise<Uint8Array> {
    const out = new Uint8Array(count);
    for (let i = 0; i < count; i += 1) {
      out[i] = await this.readByte(timeoutMs);
    }
    return out;
  }

  private async sendRawBody(body: Uint8Array): Promise<void> {
    if (!this.writer) throw new Error("Serial writer unavailable");
    const packet = new Uint8Array(WCH_UART_REQ_PREFIX.length + body.length + 1);
    packet.set(WCH_UART_REQ_PREFIX, 0);
    packet.set(body, WCH_UART_REQ_PREFIX.length);
    packet[packet.length - 1] = wchIspRequestChecksum(body);
    await this.writer.write(packet);
  }

  private async recvFrame(timeoutMs: number): Promise<Uint8Array> {
    while (true) {
      const b = await this.readByte(timeoutMs);
      if (b !== WCH_UART_RESP_MAGIC[0]) continue;
      const b2 = await this.readByte(timeoutMs);
      if (b2 === WCH_UART_RESP_MAGIC[1]) break;
    }
    const header = await this.readExact(4, timeoutMs);
    const len = header[2] | (header[3] << 8);
    if (len <= 0 || len > 0x10000) {
      throw new Error(`无效应答长度 ${len}`);
    }
    const rest = await this.readExact(len + 1, timeoutMs);
    const payload = rest.subarray(0, len);
    const cksum = rest[len];
    const body = new Uint8Array(4 + len);
    body.set(header, 0);
    body.set(payload, 4);
    let sum = 0;
    for (let i = 0; i < body.length; i += 1) {
      sum = (sum + body[i]) & 0xff;
    }
    if (sum !== cksum) {
      throw new Error(`应答校验失败: 期望 ${cksum}, 计算 ${sum}`);
    }
    return body;
  }

  private async transfer(body: Uint8Array, timeoutMs: number): Promise<ParsedWchIspResponse> {
    await new Promise((r) => window.setTimeout(r, 0));
    await this.sendRawBody(body);
    await new Promise((r) => window.setTimeout(r, 1));
    const raw = await this.recvFrame(timeoutMs);
    const parsed = parseWchIspResponseFrame(raw);
    if (parsed.command !== body[0]) {
      throw new Error(`应答命令不匹配: 请求 0x${body[0].toString(16)}, 应答 0x${parsed.command.toString(16)}`);
    }
    return parsed;
  }

  /**
   * 探测芯片：IDENTIFY → 查表 → READ_CONFIG 取 UID。
   */
  async identify(): Promise<{ label: string }> {
    const idBody = buildIdentifyPacket(0, 0);
    const idResp = await this.transfer(idBody, 2000);
    if (idResp.payload.length < 2) {
      throw new Error("IDENTIFY 应答过短");
    }
    const chipId = idResp.payload[0];
    const deviceType = idResp.payload[1];
    const variant = findCh32Variant(chipId, deviceType);
    if (!variant) {
      throw new Error(
        `未收录的 CH32：chipId=0x${chipId.toString(16)} deviceType=0x${deviceType.toString(16)}，请更新 ch32ChipCatalog`,
      );
    }
    this.chip = variant;

    const cfgBody = buildReadConfigPacket(WCH_CFG_MASK_ALL);
    const cfgResp = await this.transfer(cfgBody, 2000);
    const uidBytes = ch32UidByteCount(deviceType);
    const uidStart = 18;
    if (cfgResp.payload.length < uidStart + uidBytes) {
      throw new Error("READ_CONFIG 应答过短，无法读取 UID");
    }
    this.chipUid = cfgResp.payload.subarray(uidStart, uidStart + uidBytes);

    const label = `${variant.name} (${variant.familyName})`;
    return { label };
  }

  private assertChip(): Ch32ChipVariant {
    if (!this.chip) throw new Error("CH32 未识别");
    return this.chip;
  }

  private async ispKeyExchange(): Promise<void> {
    const chip = this.assertChip();
    const key = xorKeyFromUid(this.chipUid, chip.chipId);
    let keyChecksum = 0;
    for (let i = 0; i < key.length; i += 1) {
      keyChecksum = (keyChecksum + key[i]) & 0xff;
    }
    const seed = new Uint8Array(ISP_KEY_SEED_LEN).fill(0);
    const body = buildIspKeyPacket(seed);
    const resp = await this.transfer(body, 2000);
    if (resp.payload.length < 1 || resp.payload[0] !== keyChecksum) {
      throw new Error("ISP_KEY 校验失败");
    }
  }

  async eraseCodeFlashForBinaryLength(binaryLength: number): Promise<void> {
    const chip = this.assertChip();
    const paddedLen = extendToSectorBoundary(new Uint8Array(binaryLength)).byteLength;
    let sectors = Math.floor(paddedLen / WCH_SECTOR_SIZE) + 1;
    const minSectors = ch32MinEraseSectorCount(chip.deviceType);
    if (sectors < minSectors) {
      sectors = minSectors;
    }
    const body = buildErasePacket(sectors >>> 0);
    await this.transfer(body, 8000);
    await new Promise((r) => window.setTimeout(r, 1000));
  }

  async programCodeFlash(flashAddress: number, firmware: Uint8Array, onProgress: (written: number, total: number) => void): Promise<void> {
    const chip = this.assertChip();
    await this.ispKeyExchange();
    const key = xorKeyFromUid(this.chipUid, chip.chipId);
    const binary = extendToSectorBoundary(firmware);
    const base = codeFlashOffsetFromAddress(flashAddress);
    let address = base >>> 0;
    const total = binary.byteLength;
    for (let offset = 0; offset < total; offset += WCH_ISP_CHUNK_SIZE) {
      const chunk = binary.subarray(offset, Math.min(offset + WCH_ISP_CHUNK_SIZE, total));
      const xored = xorDataWithKey(chunk, key);
      const padding = randomU8();
      const body = buildProgramPacket(address, padding, xored);
      await this.transfer(body, 400);
      address = (address + chunk.byteLength) >>> 0;
      onProgress(Math.min(offset + chunk.byteLength, total), total);
    }
    await this.ispKeyExchange();
    const empty = buildProgramPacket(address, randomU8(), new Uint8Array(0));
    await this.transfer(empty, 400);
    await new Promise((r) => window.setTimeout(r, 200));
  }

  async verifyCodeFlash(flashAddress: number, firmware: Uint8Array, onProgress: (done: number, total: number) => void): Promise<void> {
    const chip = this.assertChip();
    await this.ispKeyExchange();
    const key = xorKeyFromUid(this.chipUid, chip.chipId);
    const binary = extendToSectorBoundary(firmware);
    const base = codeFlashOffsetFromAddress(flashAddress);
    let address = base >>> 0;
    const total = binary.byteLength;
    for (let offset = 0; offset < total; offset += WCH_ISP_CHUNK_SIZE) {
      const chunk = binary.subarray(offset, Math.min(offset + WCH_ISP_CHUNK_SIZE, total));
      const xored = xorDataWithKey(chunk, key);
      const padding = randomU8();
      const body = buildVerifyPacket(address, padding, xored);
      const resp = await this.transfer(body, 2000);
      if (resp.payload.length < 1 || resp.payload[0] !== 0x00) {
        throw new Error("VERIFY 与芯片内 Flash 不一致");
      }
      address = (address + chunk.byteLength) >>> 0;
      onProgress(Math.min(offset + chunk.byteLength, total), total);
    }
  }

  async ispEndReset(): Promise<void> {
    const body = buildIspEndPacket(1);
    try {
      await this.transfer(body, 2000);
    } catch {
      /* 复位后链路可能断开，忽略 */
    }
  }
}
