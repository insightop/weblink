import type { BridgeBackendId } from "../../matrix/types";
import type { SpiPort } from "../../domain/spi/SpiPort";
import type { I2cPort } from "../../domain/i2c/I2cPort";

export interface BridgeBackend {
  readonly id: BridgeBackendId;
  /** 声明接口、完成桥初始化（CH341: config_stream + enable_pins） */
  open(): Promise<void>;
  getSpiPort(): SpiPort | null;
  getI2cPort(): I2cPort | null;
  close(): Promise<void>;
}
