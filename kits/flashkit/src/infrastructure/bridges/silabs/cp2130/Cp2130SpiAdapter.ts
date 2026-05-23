import type { SpiPort } from "../../../../domain/spi/SpiPort";
import { WebUsbSession } from "../../../usb/WebUsbSession";
import {
  packCp2130BulkRead,
  packCp2130BulkWrite,
  packCp2130BulkWriteRead,
} from "./cp2130Bulk";

export class Cp2130SpiAdapter implements SpiPort {
  constructor(private readonly session: WebUsbSession) {}

  async transfer(write: Uint8Array, readLength: number): Promise<Uint8Array> {
    if (write.length === 0 && readLength === 0) {
      return new Uint8Array(0);
    }
    if (write.length === 0) {
      const out = packCp2130BulkRead(readLength);
      await this.session.bulkOut(out);
      return await this.session.bulkInExactly(readLength);
    }
    if (readLength === 0) {
      const out = packCp2130BulkWrite(write);
      await this.session.bulkOut(out);
      return new Uint8Array(0);
    }
    const duplex = new Uint8Array(write.length + readLength);
    duplex.set(write, 0);
    duplex.fill(0xff, write.length);
    const out = packCp2130BulkWriteRead(duplex);
    await this.session.bulkOut(out);
    const raw = await this.session.bulkInExactly(duplex.length);
    return raw.subarray(write.length);
  }
}
