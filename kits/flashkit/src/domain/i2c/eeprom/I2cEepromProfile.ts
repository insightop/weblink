export interface I2cEepromProfile {
  readonly id: string;
  readonly name: string;
  /** 7-bit I²C 基址（不含 A0-A2 硬件脚位时需在外部合并） */
  readonly baseAddr7: number;
  readonly sizeBytes: number;
  readonly pageSize: number;
  readonly addrBytes: 1 | 2;
}
