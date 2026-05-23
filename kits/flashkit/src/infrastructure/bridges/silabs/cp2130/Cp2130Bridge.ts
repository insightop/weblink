import type { BridgeBackend } from "../../BridgeBackend";
import type { SpiPort } from "../../../../domain/spi/SpiPort";
import type { I2cPort } from "../../../../domain/i2c/I2cPort";
import { WebUsbSession } from "../../../usb/WebUsbSession";
import { Cp2130SpiAdapter } from "./Cp2130SpiAdapter";
import {
  CP2130_SPI_CLOCK_3MHZ,
  Cp2130VendorCommand,
} from "./cp2130Constants";
import { FlashKitError, FlashKitErrorCode } from "../../../../domain/errors/FlashKitError";

/** CS 模式：独占自动片选（与 Silicon Labs 参考枚举一致） */
const CP2130_CS_EXCLUSIVE = 2;

export class Cp2130Bridge implements BridgeBackend {
  readonly id = "silabs-cp2130-hid" as const;
  private readonly spi: Cp2130SpiAdapter;
  private opened = false;

  constructor(private readonly session: WebUsbSession) {
    this.spi = new Cp2130SpiAdapter(this.session);
  }

  async open(): Promise<void> {
    if (this.opened) return;
    await this.session.open();
    const ver = await this.session.controlTransferIn(
      { requestType: "vendor", recipient: "device", request: Cp2130VendorCommand.GetReadOnlyVersion, value: 0, index: 0 },
      2,
    );
    if (ver.status !== "ok" || !ver.data) {
      throw new FlashKitError(FlashKitErrorCode.USB_TRANSFER_FAILED, "CP2130 read version failed");
    }
    const ch = 0;
    const flags = 0x08 | (CP2130_SPI_CLOCK_3MHZ & 7);
    await this.vendorOut(Cp2130VendorCommand.SetSpiWord, new Uint8Array([ch, flags]));
    await this.vendorOut(Cp2130VendorCommand.SetGpioChipSelect, new Uint8Array([ch, CP2130_CS_EXCLUSIVE]));
    await this.vendorOut(Cp2130VendorCommand.SetSpiDelay, new Uint8Array([ch, 0, 0, 0, 0]));
    this.opened = true;
  }

  getSpiPort(): SpiPort | null {
    return this.spi;
  }

  getI2cPort(): I2cPort | null {
    return null;
  }

  async close(): Promise<void> {
    this.opened = false;
    await this.session.close();
  }

  private async vendorOut(request: number, data: Uint8Array): Promise<void> {
    const r = await this.session.controlTransferOut(
      { requestType: "vendor", recipient: "device", request, value: 0, index: 0 },
      data,
    );
    if (r.status !== "ok") {
      throw new FlashKitError(FlashKitErrorCode.USB_TRANSFER_FAILED, `CP2130 vendor OUT failed: ${r.status}`);
    }
  }
}
