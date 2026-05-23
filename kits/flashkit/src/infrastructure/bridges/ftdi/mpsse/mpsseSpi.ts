import {
  MPSSE_CLOCK_DATA_IN_OUT_MSB,
  MPSSE_DISABLE_3_PHASE,
  MPSSE_DISABLE_CLK_DIV5,
  MPSSE_LOOPBACK_END,
  MPSSE_SET_BITS_LOW,
  MPSSE_TCK_DIVISOR,
} from "../ftdiConstants";

/** ADBUS：SK=0, MOSI=1, MISO=2, CS#=3（空闲 CS 为高） */
const DIR_ADBUS_SPI = 0x0b;
const CS_HIGH = 0x08;
const CS_LOW = 0x00;

/**
 * 构建 MPSSE 初始化序列：关回环、关闭 div5、关三相位时钟、设置 TCK 分频。
 * FT232H 内部 12MHz 基准，AN135：f_TCK = 12MHz / (2 * (1 + divisor))。
 */
export function buildMpsseSpiInitCommands(divisorLow: number, divisorHigh: number): Uint8Array {
  return Uint8Array.from([
    MPSSE_LOOPBACK_END,
    MPSSE_DISABLE_CLK_DIV5,
    MPSSE_TCK_DIVISOR,
    divisorLow & 0xff,
    divisorHigh & 0xff,
    MPSSE_DISABLE_3_PHASE,
    MPSSE_SET_BITS_LOW,
    CS_HIGH,
    DIR_ADBUS_SPI,
  ]);
}

/** 约 1 MHz SPI：div=5 -> 12 / (2 * 6) = 1 MHz */
export const FT232H_DIV_1MHZ = { low: 5, high: 0 };

export function buildSetCs(asserted: boolean): Uint8Array {
  return new Uint8Array([MPSSE_SET_BITS_LOW, asserted ? CS_LOW : CS_HIGH, DIR_ADBUS_SPI]);
}

/**
 * 将一次 SPI 全双工缓冲区拆成若干 `0x31` 事务（每段最多 256 字节）。
 * 返回的 OUT 流不含 CS；由调用方在两侧包夹 `buildSetCs`。
 */
export function buildMpsseDuplexMsbChunks(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const chunk = Math.min(256, data.length - i);
    out.push(MPSSE_CLOCK_DATA_IN_OUT_MSB, chunk - 1);
    for (let j = 0; j < chunk; j++) {
      out.push(data[i++]);
    }
  }
  return new Uint8Array(out);
}

export function concatMpsse(parts: readonly Uint8Array[]): Uint8Array {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const r = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    r.set(p, o);
    o += p.length;
  }
  return r;
}

/** 与 `buildMpsseDuplexMsbChunks` 输出配对：主机应从 IN 端读回的字节数（仅 0x31 段） */
export function countMpsseDuplexReplyBytes(dataLength: number): number {
  return dataLength;
}
