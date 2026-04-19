import {
  CH341A_CMD_I2C_STREAM,
  CH341A_CMD_I2C_STM_END,
  CH341A_CMD_I2C_STM_IN,
  CH341A_CMD_I2C_STM_OUT,
  CH341A_CMD_I2C_STM_STA,
  CH341A_CMD_I2C_STM_STO,
} from "@/infrastructure/bridges/ch341/ch341Constants";

/**
 * 构造与 WCH 示例（单 AA 头）一致的 I²C 流：随机读（16-bit 片内地址）常见 AT24Cxxx。
 * 参考：`ch341_i2c_example_in_english.c` 中 `PCF8574_ReadIO` 的拼接方式。
 */
export function buildAt24RandomReadStream(devAddr7: number, memAddr: number, readLen: number): Uint8Array {
  if (readLen <= 0) {
    return new Uint8Array(0);
  }
  const slaW = (devAddr7 << 1) & 0xff;
  const slaR = slaW | 1;
  const ahi = (memAddr >> 8) & 0xff;
  const alo = memAddr & 0xff;

  const parts: number[] = [];
  parts.push(CH341A_CMD_I2C_STREAM, CH341A_CMD_I2C_STM_STA);
  parts.push(CH341A_CMD_I2C_STM_OUT | 3, slaW, ahi, alo);
  parts.push(CH341A_CMD_I2C_STM_STA);
  parts.push(CH341A_CMD_I2C_STM_OUT | 1, slaR);

  let left = readLen;
  while (left > 0) {
    const n = Math.min(31, left);
    parts.push(CH341A_CMD_I2C_STM_IN | n);
    left -= n;
  }
  parts.push(CH341A_CMD_I2C_STM_STO);
  parts.push(CH341A_CMD_I2C_STM_END);
  return Uint8Array.from(parts);
}

/** 页写：START + OUT(设备写地址 + payload) + STOP */
export function buildAt24PageWriteStream(devAddr7: number, payload: Uint8Array): Uint8Array {
  if (payload.length === 0) {
    return new Uint8Array(0);
  }
  /** WCH 示例：单帧 OUT 长度 ≤ 29（含从机地址字节） */
  if (payload.length > 28) {
    throw new Error("CH341 I2C page payload too large for single stream (max 28 bytes incl. addr)");
  }
  const slaW = (devAddr7 << 1) & 0xff;
  const outLen = 1 + payload.length;
  const parts: number[] = [];
  parts.push(CH341A_CMD_I2C_STREAM, CH341A_CMD_I2C_STM_STA);
  parts.push(CH341A_CMD_I2C_STM_OUT | outLen, slaW);
  for (let i = 0; i < payload.length; i++) {
    parts.push(payload[i] ?? 0);
  }
  parts.push(CH341A_CMD_I2C_STM_STO, CH341A_CMD_I2C_STM_END);
  return Uint8Array.from(parts);
}
