import type { BridgeBackend } from "@/infrastructure/bridges/BridgeBackend";
import type { SpiPort } from "@/domain/spi/SpiPort";
import type { I2cPort } from "@/domain/i2c/I2cPort";
import { WebHidSession } from "@/infrastructure/hid/WebHidSession";
import { Cp2112I2cAdapter } from "@/infrastructure/bridges/silabs/cp2112/Cp2112I2cAdapter";

export class Cp2112Bridge implements BridgeBackend {
  readonly id = "silabs-cp2112-hid" as const;
  private readonly i2c: Cp2112I2cAdapter;
  private opened = false;

  constructor(private readonly session: WebHidSession) {
    this.i2c = new Cp2112I2cAdapter(this.session);
  }

  async open(): Promise<void> {
    if (this.opened) return;
    await this.session.open();
    this.opened = true;
  }

  getSpiPort(): SpiPort | null {
    return null;
  }

  getI2cPort(): I2cPort | null {
    return this.i2c;
  }

  async close(): Promise<void> {
    this.opened = false;
    await this.session.close();
  }
}
