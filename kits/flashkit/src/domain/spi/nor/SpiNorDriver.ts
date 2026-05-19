import type { SpiPort } from "@/domain/spi/SpiPort";
import type { SpiNorProfile } from "@/domain/spi/nor/SpiNorProfile";
import { parseJedecId } from "@/domain/spi/jedec/jedecId";
import { FlashKitError, FlashKitErrorCode } from "@/domain/errors/FlashKitError";

export interface SpiNorProgress {
  readonly phase: "identify" | "erase" | "program" | "verify" | "idle";
  readonly bytesProcessed: number;
  readonly totalBytes: number;
}

function encodeAddress(profile: SpiNorProfile, offset: number): Uint8Array {
  if (profile.addressBytes === 3) {
    return new Uint8Array([(offset >> 16) & 0xff, (offset >> 8) & 0xff, offset & 0xff]);
  }
  if (profile.addressBytes === 2) {
    return new Uint8Array([(offset >> 8) & 0xff, offset & 0xff]);
  }
  return new Uint8Array([
    (offset >> 24) & 0xff,
    (offset >> 16) & 0xff,
    (offset >> 8) & 0xff,
    offset & 0xff,
  ]);
}

export class SpiNorDriver {
  constructor(
    private readonly port: SpiPort,
    private readonly profile: SpiNorProfile,
  ) {}

  async readJedecId(): Promise<ReturnType<typeof parseJedecId>> {
    const cmd = new Uint8Array([this.profile.cmd.readJedecId]);
    const raw = await this.port.transfer(cmd, 3);
    return parseJedecId(raw);
  }

  assertJedecMatch(): void {
    /* 在调用方用 readJedecId 比对 */
  }

  private async readStatus(): Promise<number> {
    const cmd = new Uint8Array([this.profile.cmd.readStatus]);
    const r = await this.port.transfer(cmd, 1);
    return r[0] ?? 0;
  }

  private async waitWipClear(timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const st = await this.readStatus();
      if ((st & this.profile.statusWipMask) === 0) {
        return;
      }
      await new Promise((r) => setTimeout(r, 1));
    }
    throw new FlashKitError(FlashKitErrorCode.USB_TRANSFER_FAILED, "SPI NOR: WIP timeout");
  }

  private async writeEnable(): Promise<void> {
    await this.port.transfer(new Uint8Array([this.profile.cmd.writeEnable]), 0);
  }

  async readRange(offset: number, length: number, onProgress?: (p: SpiNorProgress) => void): Promise<Uint8Array> {
    if (offset + length > this.profile.sizeBytes) {
      throw new FlashKitError(FlashKitErrorCode.INVALID_ARGUMENT, "Read out of range");
    }
    const out = new Uint8Array(length);
    let o = 0;
    const chunkMax = 256;
    while (o < length) {
      const n = Math.min(chunkMax, length - o);
      const addr = offset + o;
      const hdr = new Uint8Array(1 + this.profile.addressBytes);
      hdr[0] = this.profile.cmd.read;
      const enc = encodeAddress(this.profile, addr);
      hdr.set(enc, 1);
      const data = await this.port.transfer(hdr, n);
      out.set(data, o);
      o += n;
      onProgress?.({
        phase: "idle",
        bytesProcessed: o,
        totalBytes: length,
      });
    }
    return out;
  }

  async sectorErase(offset: number): Promise<void> {
    if (offset % this.profile.sectorSize !== 0) {
      throw new FlashKitError(FlashKitErrorCode.INVALID_ARGUMENT, "Sector erase offset must be aligned");
    }
    await this.writeEnable();
    const hdr = new Uint8Array(1 + this.profile.addressBytes);
    hdr[0] = this.profile.cmd.sectorErase;
    hdr.set(encodeAddress(this.profile, offset), 1);
    await this.port.transfer(hdr, 0);
    await this.waitWipClear(30_000);
  }

  async programRange(
    offset: number,
    data: Uint8Array,
    onProgress?: (p: SpiNorProgress) => void,
  ): Promise<void> {
    if (offset + data.length > this.profile.sizeBytes) {
      throw new FlashKitError(FlashKitErrorCode.INVALID_ARGUMENT, "Program out of range");
    }
    const pageSize = this.profile.pageSize;
    for (let base = 0; base < data.length; base += pageSize) {
      const chunk = data.subarray(base, Math.min(base + pageSize, data.length));
      await this.writeEnable();
      const hdr = new Uint8Array(1 + this.profile.addressBytes + chunk.length);
      hdr[0] = this.profile.cmd.pageProgram;
      hdr.set(encodeAddress(this.profile, offset + base), 1);
      hdr.set(chunk, 1 + this.profile.addressBytes);
      await this.port.transfer(hdr, 0);
      await this.waitWipClear(10_000);
      onProgress?.({
        phase: "program",
        bytesProcessed: base + chunk.length,
        totalBytes: data.length,
      });
    }
  }

  async verifyEqual(offset: number, expected: Uint8Array): Promise<void> {
    const actual = await this.readRange(offset, expected.length);
    for (let i = 0; i < expected.length; i++) {
      if (actual[i] !== expected[i]) {
        throw new FlashKitError(
          FlashKitErrorCode.VERIFY_FAILED,
          `Verify mismatch at offset ${offset + i}`,
        );
      }
    }
  }
}
