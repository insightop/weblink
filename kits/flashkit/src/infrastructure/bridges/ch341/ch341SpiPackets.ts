import {
  CH341_PACKET_LENGTH,
  CH341A_CMD_SPI_STREAM,
  CH341A_CMD_UIO_STREAM,
  CH341A_CMD_UIO_STM_END,
  CH341A_CMD_UIO_STM_OUT,
} from "./ch341Constants";
import { swapCh341SpiByte } from "./ch341BitOrder";

export interface Ch341aSpiBuiltTransaction {
  readonly out: Uint8Array;
  /** 期望从 USB IN 聚合的总字节数（flashrom `usb_transfer` 的 readcnt） */
  readonly expectedInTotal: number;
}

function min(a: number, b: number): number {
  return a < b ? a : b;
}

/**
 * 生成 CS 抖动序列（flashrom `pluck_cs`），`delayCnt` 默认 2。
 */
export function buildPluckCs(delayCnt = 2): Uint8Array {
  const parts: number[] = [];
  parts.push(CH341A_CMD_UIO_STREAM);
  parts.push(CH341A_CMD_UIO_STM_OUT | 0x37);
  for (let i = 0; i < delayCnt; i++) {
    parts.push(CH341A_CMD_UIO_STM_OUT | 0x37);
  }
  parts.push(CH341A_CMD_UIO_STM_OUT | 0x36);
  parts.push(CH341A_CMD_UIO_STM_END);
  return Uint8Array.from(parts);
}

/**
 * 构造与 flashrom `ch341a_spi_spi_send_command` 等价的 OUT 缓冲与 IN 期望长度。
 */
export function buildCh341aSpiTransaction(write: Uint8Array, readCount: number): Ch341aSpiBuiltTransaction {
  const writecnt = write.length;
  const packets = Math.floor((writecnt + readCount + CH341_PACKET_LENGTH - 2) / (CH341_PACKET_LENGTH - 1));

  const outChunks: Uint8Array[] = [];

  const row0 = new Uint8Array(CH341_PACKET_LENGTH);
  const pluck = buildPluckCs(2);
  row0.set(pluck, 0);

  outChunks.push(row0);

  let writeLeft = writecnt;
  let readLeft = readCount;
  const writearr = write;

  let writeIdx = 0;
  for (let p = 0; p < packets; p++) {
    const writeNow = min(CH341_PACKET_LENGTH - 1, writeLeft);
    const readNow = min(CH341_PACKET_LENGTH - 1 - writeNow, readLeft);

    const row = new Uint8Array(1 + writeNow + readNow);
    let o = 0;
    row[o++] = CH341A_CMD_SPI_STREAM;
    for (let i = 0; i < writeNow; i++) {
      row[o++] = swapCh341SpiByte(writearr[writeIdx++]);
    }
    if (readNow > 0) {
      row.fill(0xff, o, o + readNow);
      o += readNow;
      readLeft -= readNow;
    }
    writeLeft -= writeNow;
    outChunks.push(row.subarray(0, o));
  }

  const totalOut =
    CH341_PACKET_LENGTH + packets + writecnt + readCount;

  const out = new Uint8Array(totalOut);
  let pos = 0;
  for (const chunk of outChunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  if (pos !== totalOut) {
    throw new Error(`CH341 SPI pack mismatch: pos=${pos} totalOut=${totalOut}`);
  }

  const expectedInTotal = writecnt + readCount;
  return { out, expectedInTotal };
}
