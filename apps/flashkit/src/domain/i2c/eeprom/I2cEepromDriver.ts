import type { I2cPort } from "@/domain/i2c/I2cPort";
import type { I2cEepromProfile } from "@/domain/i2c/eeprom/I2cEepromProfile";
import { FlashKitError, FlashKitErrorCode } from "@/domain/errors/FlashKitError";

function encodeAddr16(addr: number): Uint8Array {
  return new Uint8Array([(addr >> 8) & 0xff, addr & 0xff]);
}

export class I2cEepromDriver {
  constructor(
    private readonly port: I2cPort,
    private readonly profile: I2cEepromProfile,
  ) {}

  async readRange(offset: number, length: number): Promise<Uint8Array> {
    if (this.profile.addrBytes !== 2) {
      throw new FlashKitError(FlashKitErrorCode.INVALID_ARGUMENT, "Only 16-bit address EEPROM is supported");
    }
    if (offset + length > this.profile.sizeBytes) {
      throw new FlashKitError(FlashKitErrorCode.INVALID_ARGUMENT, "Read out of range");
    }
    const out = new Uint8Array(length);
    let o = 0;
    const chunk = 64;
    while (o < length) {
      const n = Math.min(chunk, length - o);
      const memAddr = offset + o;
      const addrBytes = encodeAddr16(memAddr);
      const slice = await this.port.writeRead(this.profile.baseAddr7, addrBytes, n);
      out.set(slice, o);
      o += n;
    }
    return out;
  }

  /**
   * 页写；跨页拆分。单帧 I²C OUT（CH341）有效载荷上限约 29B，故每段最多 26B 数据（含 2B 地址）。
   */
  async programRange(offset: number, data: Uint8Array): Promise<void> {
    if (this.profile.addrBytes !== 2) {
      throw new FlashKitError(FlashKitErrorCode.INVALID_ARGUMENT, "Only 16-bit address EEPROM is supported");
    }
    if (offset + data.length > this.profile.sizeBytes) {
      throw new FlashKitError(FlashKitErrorCode.INVALID_ARGUMENT, "Program out of range");
    }
    const page = this.profile.pageSize;
    const maxDataPerFrame = 26;
    for (let base = 0; base < data.length; ) {
      const pageOffset = offset + base;
      const pageRemain = page - (pageOffset % page);
      const room = Math.min(pageRemain, maxDataPerFrame, data.length - base);
      const chunk = data.subarray(base, base + room);
      const payload = new Uint8Array(2 + chunk.length);
      payload.set(encodeAddr16(pageOffset), 0);
      payload.set(chunk, 2);
      await this.port.writeRead(this.profile.baseAddr7, payload, 0);
      base += room;
      await sleepMs(5);
    }
  }
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
