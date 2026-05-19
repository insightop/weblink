import type { SpiPort } from "@/domain/spi/SpiPort";
import { WebUsbSession } from "@/infrastructure/usb/WebUsbSession";
import { buildCh341aSpiTransaction } from "@/infrastructure/bridges/ch341/ch341SpiPackets";
import { swapCh341SpiByte } from "@/infrastructure/bridges/ch341/ch341BitOrder";

export class Ch341SpiAdapter implements SpiPort {
  constructor(private readonly session: WebUsbSession) {}

  async transfer(write: Uint8Array, readLength: number): Promise<Uint8Array> {
    const { out, expectedInTotal } = buildCh341aSpiTransaction(write, readLength);
    await this.session.bulkOut(out);
    const rawIn = await this.session.bulkInExactly(expectedInTotal);
    if (readLength === 0) {
      return new Uint8Array(0);
    }
    const miso = rawIn.subarray(write.length, write.length + readLength);
    const decoded = new Uint8Array(readLength);
    for (let i = 0; i < readLength; i++) {
      decoded[i] = swapCh341SpiByte(miso[i] ?? 0);
    }
    return decoded;
  }
}
