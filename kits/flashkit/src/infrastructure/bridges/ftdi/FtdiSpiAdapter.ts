import type { SpiPort } from "../../../domain/spi/SpiPort";
import { WebUsbSession } from "../../usb/WebUsbSession";
import {
  buildMpsseDuplexMsbChunks,
  buildSetCs,
  concatMpsse,
  countMpsseDuplexReplyBytes,
} from "./mpsse/mpsseSpi";

export class FtdiSpiAdapter implements SpiPort {
  constructor(private readonly session: WebUsbSession) {}

  async transfer(write: Uint8Array, readLength: number): Promise<Uint8Array> {
    const duplex = new Uint8Array(write.length + readLength);
    duplex.set(write, 0);
    if (readLength > 0) {
      duplex.fill(0xff, write.length);
    }
    const mid = buildMpsseDuplexMsbChunks(duplex);
    const script = concatMpsse([buildSetCs(true), mid, buildSetCs(false)]);
    await this.session.bulkOut(script);
    const inBytes = countMpsseDuplexReplyBytes(duplex.length);
    if (inBytes === 0) {
      return new Uint8Array(0);
    }
    const raw = await this.session.bulkInExactly(inBytes);
    return raw.subarray(write.length);
  }
}
