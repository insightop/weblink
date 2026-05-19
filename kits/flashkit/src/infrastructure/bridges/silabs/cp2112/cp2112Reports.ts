/**
 * CP2112 HID 报告 ID 与载荷布局（参见 Silicon Labs AN495 / Linux `hid-cp2112.c` 中的公开结构）。
 */

export const CP2112_DATA_READ_REQUEST = 0x10;
export const CP2112_DATA_WRITE_READ_REQUEST = 0x11;
export const CP2112_DATA_READ_FORCE_SEND = 0x12;
export const CP2112_DATA_READ_RESPONSE = 0x13;
export const CP2112_DATA_WRITE_REQUEST = 0x14;
export const CP2112_TRANSFER_STATUS_REQUEST = 0x15;
export const CP2112_TRANSFER_STATUS_RESPONSE = 0x16;
export const CP2112_SMBUS_CONFIG = 0x06;

export const CP2112_STATUS0_IDLE = 0x00;
export const CP2112_STATUS0_BUSY = 0x01;
export const CP2112_STATUS0_COMPLETE = 0x02;
export const CP2112_STATUS0_ERROR = 0x03;

export const CP2112_STATUS1_SUCCESS = 0x05;

export function encodeCp2112ReadRequest(addr7: number, length: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = addr7 << 1;
  buf[1] = (length >> 8) & 0xff;
  buf[2] = length & 0xff;
  return buf;
}

export function encodeCp2112WriteRequest(addr7: number, data: Uint8Array): Uint8Array {
  const buf = new Uint8Array(2 + data.length);
  buf[0] = addr7 << 1;
  buf[1] = data.length;
  buf.set(data, 2);
  return buf;
}

export function encodeCp2112WriteReadRequest(addr7: number, addrBytes: Uint8Array, readLength: number): Uint8Array {
  const buf = new Uint8Array(4 + addrBytes.length);
  buf[0] = addr7 << 1;
  buf[1] = (readLength >> 8) & 0xff;
  buf[2] = readLength & 0xff;
  buf[3] = addrBytes.length;
  buf.set(addrBytes, 4);
  return buf;
}

/** `DataView` 为浏览器 `inputreport` 载荷（通常不含 report id 前缀） */
export function parseCp2112TransferStatus(data: DataView): { status0: number; status1: number; length: number } {
  const status0 = data.getUint8(0);
  const status1 = data.getUint8(1);
  const length = data.getUint16(4, false);
  return { status0, status1, length };
}
