import {
  CP2130_TRANSFER_READ,
  CP2130_TRANSFER_WRITE,
  CP2130_TRANSFER_WRITE_READ,
} from "@/infrastructure/bridges/silabs/cp2130/cp2130Constants";

function writeHeader(
  target: Uint8Array,
  offset: number,
  cmd: number,
  length: number,
): void {
  target[offset] = 0;
  target[offset + 1] = 0;
  target[offset + 2] = cmd;
  target[offset + 3] = 0;
  new DataView(target.buffer, target.byteOffset + offset + 4, 4).setUint32(0, length, true);
}

export function packCp2130BulkRead(length: number): Uint8Array {
  const buf = new Uint8Array(8);
  writeHeader(buf, 0, CP2130_TRANSFER_READ, length);
  return buf;
}

export function packCp2130BulkWrite(payload: Uint8Array): Uint8Array {
  const buf = new Uint8Array(8 + payload.length);
  writeHeader(buf, 0, CP2130_TRANSFER_WRITE, payload.length);
  buf.set(payload, 8);
  return buf;
}

export function packCp2130BulkWriteRead(payload: Uint8Array): Uint8Array {
  const buf = new Uint8Array(8 + payload.length);
  writeHeader(buf, 0, CP2130_TRANSFER_WRITE_READ, payload.length);
  buf.set(payload, 8);
  return buf;
}
