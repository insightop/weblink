export interface SpiNorProfile {
  readonly id: string;
  readonly name: string;
  readonly jedec: { manufacturerId: number; deviceIdHigh: number; deviceIdLow: number };
  readonly sizeBytes: number;
  readonly pageSize: number;
  readonly sectorSize: number;
  readonly addressBytes: 2 | 3 | 4;
  readonly cmd: {
    readonly read: number;
    readonly pageProgram: number;
    readonly sectorErase: number;
    readonly writeEnable: number;
    readonly readStatus: number;
    readonly readJedecId: number;
  };
  /** 状态寄存器 WIP 位掩码 */
  readonly statusWipMask: number;
}
