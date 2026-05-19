import { WCH_ISP_COMMAND } from "@/protocols/ch32/serial/wchUartIspTypes";

function u16Le(value: number): [number, number] {
  const v = value & 0xffff;
  return [v & 0xff, (v >> 8) & 0xff];
}

function u32LeBytes(value: number): Uint8Array {
  const v = value >>> 0;
  return new Uint8Array([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]);
}

/** 请求包体校验：对命令字节序列做 8 位累加和（溢出环绕，与 wchisp SerialTransport 一致） */
export function wchIspRequestChecksum(body: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < body.length; i += 1) {
    sum = (sum + body[i]) & 0xff;
  }
  return sum;
}

/**
 * IDENTIFY：payload 含 device_id、device_type 及固定魔数（wchisp Command::Identify）。
 */
export function buildIdentifyPacket(deviceId: number, deviceType: number): Uint8Array {
  const magic = new TextEncoder().encode("MCU ISP & WCH.CN");
  const body = new Uint8Array(1 + 2 + 2 + magic.length);
  let o = 0;
  body[o++] = WCH_ISP_COMMAND.IDENTIFY;
  const size = 0x12;
  body[o++] = size & 0xff;
  body[o++] = (size >> 8) & 0xff;
  body[o++] = deviceId & 0xff;
  body[o++] = deviceType & 0xff;
  body.set(magic, o);
  return body;
}

export function buildIspEndPacket(reason: number): Uint8Array {
  return new Uint8Array([WCH_ISP_COMMAND.ISP_END, 0x01, 0x00, reason & 0xff]);
}

export function buildIspKeyPacket(seed: Uint8Array): Uint8Array {
  const body = new Uint8Array(3 + seed.length);
  body[0] = WCH_ISP_COMMAND.ISP_KEY;
  body[1] = seed.length & 0xff;
  body[2] = 0x00;
  body.set(seed, 3);
  return body;
}

export function buildErasePacket(sectors: number): Uint8Array {
  const body = new Uint8Array(7);
  body[0] = WCH_ISP_COMMAND.ERASE;
  body[1] = 0x04;
  body[2] = 0x00;
  body.set(u32LeBytes(sectors), 3);
  return body;
}

export function buildReadConfigPacket(bitMask: number): Uint8Array {
  return new Uint8Array([WCH_ISP_COMMAND.READ_CONFIG, 0x02, 0x00, bitMask & 0xff, 0x00]);
}

/**
 * PROGRAM / VERIFY：length 字段 = 整包长度 - 3（与 wchisp into_raw 一致）。
 */
export function buildProgramPacket(address: number, padding: number, xoredData: Uint8Array): Uint8Array {
  const innerLen = 1 + 2 + 4 + 1 + xoredData.length;
  const body = new Uint8Array(innerLen);
  let o = 0;
  body[o++] = WCH_ISP_COMMAND.PROGRAM;
  const payloadSize = innerLen - 3;
  const [lo, hi] = u16Le(payloadSize);
  body[o++] = lo;
  body[o++] = hi;
  body.set(u32LeBytes(address), o);
  o += 4;
  body[o++] = padding & 0xff;
  body.set(xoredData, o);
  return body;
}

export function buildVerifyPacket(address: number, padding: number, xoredData: Uint8Array): Uint8Array {
  const innerLen = 1 + 2 + 4 + 1 + xoredData.length;
  const body = new Uint8Array(innerLen);
  let o = 0;
  body[o++] = WCH_ISP_COMMAND.VERIFY;
  const payloadSize = innerLen - 3;
  const [lo, hi] = u16Le(payloadSize);
  body[o++] = lo;
  body[o++] = hi;
  body.set(u32LeBytes(address), o);
  o += 4;
  body[o++] = padding & 0xff;
  body.set(xoredData, o);
  return body;
}

export interface ParsedWchIspResponse {
  command: number;
  payload: Uint8Array;
}

/**
 * 解析一帧应答（不含 0x55 0xaa 魔数与末尾单字节校验）。
 * raw 为 4 字节头 + payload，与 wchisp recv_raw 拼接结果一致。
 */
export function parseWchIspResponseFrame(raw: Uint8Array): ParsedWchIspResponse {
  if (raw.length < 4) {
    throw new Error("WCH ISP 应答过短");
  }
  const command = raw[0];
  const len = raw[2] | (raw[3] << 8);
  const payload = raw.subarray(4);
  if (payload.length !== len) {
    throw new Error(`WCH ISP 应答长度不符: 期望 ${len}, 实际 ${payload.length}`);
  }
  return { command, payload };
}
