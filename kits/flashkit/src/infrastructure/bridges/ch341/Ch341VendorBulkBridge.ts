import type { BridgeBackend } from "../BridgeBackend";
import type { SpiPort } from "../../../domain/spi/SpiPort";
import type { I2cPort } from "../../../domain/i2c/I2cPort";
import { WebUsbSession } from "../../usb/WebUsbSession";
import {
  CH341A_CMD_I2C_STREAM,
  CH341A_CMD_I2C_STM_END,
  CH341A_CMD_I2C_STM_SET,
  CH341A_CMD_UIO_STREAM,
  CH341A_CMD_UIO_STM_DIR,
  CH341A_CMD_UIO_STM_END,
  CH341A_CMD_UIO_STM_OUT,
  CH341A_STM_I2C_100K,
} from "./ch341Constants";
import { Ch341SpiAdapter } from "./Ch341SpiAdapter";
import { Ch341I2cAdapter } from "./Ch341I2cAdapter";

export class Ch341VendorBulkBridge implements BridgeBackend {
  readonly id = "ch341-vendor-bulk" as const;
  private readonly spi: Ch341SpiAdapter;
  private readonly i2c: Ch341I2cAdapter;
  private opened = false;

  constructor(private readonly session: WebUsbSession) {
    this.spi = new Ch341SpiAdapter(this.session);
    this.i2c = new Ch341I2cAdapter(this.session);
  }

  async open(): Promise<void> {
    if (this.opened) return;
    await this.session.open();
    await this.configStream();
    await this.enablePins(true);
    this.opened = true;
  }

  getSpiPort(): SpiPort | null {
    return this.spi;
  }

  getI2cPort(): I2cPort | null {
    return this.i2c;
  }

  async close(): Promise<void> {
    if (!this.opened) {
      await this.session.close();
      return;
    }
    try {
      await this.enablePins(false);
    } catch {
      /* ignore */
    }
    this.opened = false;
    await this.session.close();
  }

  /** flashrom `config_stream(CH341A_STM_I2C_100K)` */
  private async configStream(): Promise<void> {
    const buf = Uint8Array.from([
      CH341A_CMD_I2C_STREAM,
      CH341A_CMD_I2C_STM_SET | (CH341A_STM_I2C_100K & 0x7),
      CH341A_CMD_I2C_STM_END,
    ]);
    await this.session.bulkOut(buf);
  }

  /** flashrom `enable_pins` */
  private async enablePins(enable: boolean): Promise<void> {
    const buf = Uint8Array.from([
      CH341A_CMD_UIO_STREAM,
      CH341A_CMD_UIO_STM_OUT | 0x37,
      CH341A_CMD_UIO_STM_DIR | (enable ? 0x3f : 0x00),
      CH341A_CMD_UIO_STM_END,
    ]);
    await this.session.bulkOut(buf);
  }
}
