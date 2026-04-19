/**
 * 抽象 I²C 主设备端口：7-bit 设备地址（不含 R/W 位）。
 */
export interface I2cPort {
  /**
   * 先写后读（含 START/RESTART/STOP 由适配器按序列拆分）。
   * @param addr7 7-bit 地址
   * @param write 写入从机数据（可空）
   * @param readLength 读取字节数
   */
  writeRead(addr7: number, write: Uint8Array, readLength: number): Promise<Uint8Array>;
}
