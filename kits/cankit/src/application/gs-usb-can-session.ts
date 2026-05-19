import type { RxFrameRow } from "@/domain/can/types.js";
import { GS_HOST_FRAME_SIZE } from "@/domain/gsusb/gs-usb-constants.js";
import { decodeGsHostFrame, encodeGsHostFrameTx } from "@/domain/gsusb/gs-usb-frame-codec.js";
import { GsUsbTransport } from "@/infrastructure/usb/gs-usb-transport.js";
import { logDebug } from "@/shared/logger.js";
import type { GsUsbConnectOptions, SessionEvent } from "./can-session.types.js";

export class GsUsbCanSession {
  private readonly transport = new GsUsbTransport();
  private seq = 0;
  private readLoopDone: Promise<void> = Promise.resolve();
  private rxRemainder = new Uint8Array(0);
  private stopped = false;

  private emit: (ev: SessionEvent) => void;

  constructor(emit: (ev: SessionEvent) => void) {
    this.emit = emit;
  }

  get connected(): boolean {
    return this.transport.isOpen();
  }

  async connect(device: USBDevice, opts: GsUsbConnectOptions): Promise<void> {
    this.seq = 0;
    this.rxRemainder = new Uint8Array(0);
    this.stopped = false;
    await this.transport.open(device);
    await this.transport.configureBitrate(opts.canBitrate);
    await this.transport.startChannel();
    this.readLoopDone = this.runReadLoop();
  }

  private appendRx(chunk: Uint8Array): void {
    const merged = new Uint8Array(this.rxRemainder.length + chunk.length);
    merged.set(this.rxRemainder, 0);
    merged.set(chunk, this.rxRemainder.length);
    this.rxRemainder = merged;
    while (this.rxRemainder.length >= GS_HOST_FRAME_SIZE) {
      const slice = this.rxRemainder.subarray(0, GS_HOST_FRAME_SIZE);
      this.rxRemainder = this.rxRemainder.subarray(GS_HOST_FRAME_SIZE);
      const ab = slice.buffer.slice(slice.byteOffset, slice.byteOffset + GS_HOST_FRAME_SIZE);
      try {
        const frame = decodeGsHostFrame(ab);
        if (!frame) continue;
        this.seq += 1;
        const row: RxFrameRow = {
          seq: this.seq,
          ts: performance.now(),
          frame,
        };
        this.emit({ type: "rx", row });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.emit({ type: "parse_error", line: "", message: msg });
        logDebug("gs_usb decode", msg);
      }
    }
  }

  private async runReadLoop(): Promise<void> {
    try {
      while (!this.stopped && this.transport.isOpen()) {
        const len = Math.max(256, this.transport.getBulkInPacketSize());
        const result = await this.transport.readBulkPacket(len);
        if (this.stopped) break;
        if (result.status !== "ok" || !result.data) continue;
        const u8 = new Uint8Array(
          result.data.buffer,
          result.data.byteOffset,
          result.data.byteLength,
        );
        this.appendRx(u8);
      }
    } catch (e) {
      if (this.stopped) return;
      this.emit({ type: "read_error", error: e });
    }
  }

  async sendFrame(payload: {
    id: number;
    extended: boolean;
    dlc: number;
    data: Uint8Array;
  }): Promise<void> {
    const ab = encodeGsHostFrameTx(payload);
    await this.transport.writeBulk(ab);
  }

  async disconnect(): Promise<void> {
    this.stopped = true;
    await this.transport.close();
    await this.readLoopDone.catch(() => undefined);
  }
}
