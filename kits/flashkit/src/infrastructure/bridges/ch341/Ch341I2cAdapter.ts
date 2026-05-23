import type { I2cPort } from "../../../domain/i2c/I2cPort";
import { WebUsbSession } from "../../usb/WebUsbSession";
import { buildAt24PageWriteStream, buildAt24RandomReadStream } from "./ch341I2cStream";

/**
 * CH341A I²C：使用 Vendor Bulk 上的 I²C 流命令（`0xAA` 头）。
 * 当前实现针对 AT24Cxxx 常见时序（16-bit 地址）；其他器件可扩展独立 builder。
 */
export class Ch341I2cAdapter implements I2cPort {
  constructor(private readonly session: WebUsbSession) {}

  async writeRead(addr7: number, write: Uint8Array, readLength: number): Promise<Uint8Array> {
    if (readLength === 0) {
      const stream = buildAt24PageWriteStream(addr7, write);
      await this.session.bulkOut(stream);
      return new Uint8Array(0);
    }

    if (write.length !== 2) {
      throw new Error("CH341 I2C: random read expects 2-byte memory address in `write` for AT24 profile");
    }
    const memAddr = ((write[0] ?? 0) << 8) | (write[1] ?? 0);
    const stream = buildAt24RandomReadStream(addr7, memAddr, readLength);
    await this.session.bulkOut(stream);
    return await this.session.bulkInExactly(readLength);
  }
}
