import type { I2cPort } from "@/domain/i2c/I2cPort";
import { WebHidSession } from "@/infrastructure/hid/WebHidSession";
import {
  CP2112_DATA_READ_FORCE_SEND,
  CP2112_DATA_READ_REQUEST,
  CP2112_DATA_READ_RESPONSE,
  CP2112_DATA_WRITE_READ_REQUEST,
  CP2112_DATA_WRITE_REQUEST,
  CP2112_STATUS0_BUSY,
  CP2112_STATUS0_COMPLETE,
  CP2112_STATUS0_ERROR,
  CP2112_STATUS0_IDLE,
  CP2112_TRANSFER_STATUS_REQUEST,
  CP2112_TRANSFER_STATUS_RESPONSE,
  encodeCp2112ReadRequest,
  encodeCp2112WriteReadRequest,
  encodeCp2112WriteRequest,
  parseCp2112TransferStatus,
} from "@/infrastructure/bridges/silabs/cp2112/cp2112Reports";
import { FlashKitError, FlashKitErrorCode } from "@/domain/errors/FlashKitError";

const XFER_STATUS_RETRIES = 10;
const RESPONSE_TIMEOUT_MS = 80;

export class Cp2112I2cAdapter implements I2cPort {
  constructor(private readonly session: WebHidSession) {}

  async writeRead(addr7: number, write: Uint8Array, readLength: number): Promise<Uint8Array> {
    if (write.length === 0 && readLength === 0) {
      return new Uint8Array(0);
    }
    if (write.length === 0) {
      await this.session.sendOutputReport(CP2112_DATA_READ_REQUEST, encodeCp2112ReadRequest(addr7, readLength));
    } else if (readLength === 0) {
      await this.session.sendOutputReport(CP2112_DATA_WRITE_REQUEST, encodeCp2112WriteRequest(addr7, write));
    } else {
      await this.session.sendOutputReport(
        CP2112_DATA_WRITE_READ_REQUEST,
        encodeCp2112WriteReadRequest(addr7, write, readLength),
      );
    }

    await this.waitXferComplete();

    if (readLength === 0) {
      return new Uint8Array(0);
    }

    const forcePayload = new Uint8Array(2);
    forcePayload[0] = (readLength >> 8) & 0xff;
    forcePayload[1] = readLength & 0xff;
    await this.session.sendOutputReport(CP2112_DATA_READ_FORCE_SEND, forcePayload);

    const ev = await this.session.waitForInputReport(CP2112_DATA_READ_RESPONSE, RESPONSE_TIMEOUT_MS);
    return this.parseReadPayload(ev.data, readLength);
  }

  private parseReadPayload(dv: DataView, maxLen: number): Uint8Array {
    const b0 = dv.getUint8(0);
    const lenIdx = b0 === CP2112_DATA_READ_RESPONSE ? 2 : 1;
    const n = Math.min(dv.getUint8(lenIdx), maxLen);
    const start = lenIdx + 1;
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = dv.getUint8(start + i);
    }
    return out;
  }

  private async waitXferComplete(): Promise<void> {
    for (let r = 0; r < XFER_STATUS_RETRIES; r++) {
      await this.session.sendOutputReport(CP2112_TRANSFER_STATUS_REQUEST, new Uint8Array([0x01]));
      const ev = await this.session.waitForInputReport(CP2112_TRANSFER_STATUS_RESPONSE, RESPONSE_TIMEOUT_MS);
      const st = parseCp2112TransferStatus(ev.data);
      if (st.status0 === CP2112_STATUS0_BUSY || st.status0 === CP2112_STATUS0_IDLE) {
        continue;
      }
      if (st.status0 === CP2112_STATUS0_COMPLETE) {
        return;
      }
      if (st.status0 === CP2112_STATUS0_ERROR) {
        throw new FlashKitError(FlashKitErrorCode.USB_TRANSFER_FAILED, `CP2112 xfer error status1=${st.status1}`);
      }
    }
    throw new FlashKitError(FlashKitErrorCode.USB_TRANSFER_FAILED, "CP2112 xfer status timeout");
  }
}
