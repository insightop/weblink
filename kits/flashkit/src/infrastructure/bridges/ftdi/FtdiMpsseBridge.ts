import type { BridgeBackend } from "../BridgeBackend";
import type { SpiPort } from "../../../domain/spi/SpiPort";
import type { I2cPort } from "../../../domain/i2c/I2cPort";
import { WebUsbSession } from "../../usb/WebUsbSession";
import {
  FTDI_RESET_PURGE_RX,
  FTDI_RESET_PURGE_TX,
  FTDI_SIO_RESET,
  FTDI_SIO_SET_BITMODE,
} from "./ftdiConstants";
import { FtdiSpiAdapter } from "./FtdiSpiAdapter";
import { buildMpsseSpiInitCommands, FT232H_DIV_1MHZ } from "./mpsse/mpsseSpi";
import { FlashKitError, FlashKitErrorCode } from "../../../domain/errors/FlashKitError";

/** FTDI 控制传输 wIndex：单通道 FT232H 常用 1（与 libftdi/pyftdi 一致） */
const FTDI_CTRL_INDEX = 1;

export class FtdiMpsseBridge implements BridgeBackend {
  readonly id = "ftdi-mpsse-ft232h" as const;
  private readonly spi: FtdiSpiAdapter;
  private opened = false;

  constructor(private readonly session: WebUsbSession) {
    this.spi = new FtdiSpiAdapter(this.session);
  }

  async open(): Promise<void> {
    if (this.opened) return;
    await this.session.open();
    await this.ftdiVendorOut(FTDI_SIO_RESET, FTDI_RESET_PURGE_RX);
    await this.ftdiVendorOut(FTDI_SIO_RESET, FTDI_RESET_PURGE_TX);
    /** MPSSE：`mode<<8`，MODE=2 */
    await this.ftdiVendorOut(FTDI_SIO_SET_BITMODE, 0x0200);
    await this.syncMpsse();
    const init = buildMpsseSpiInitCommands(FT232H_DIV_1MHZ.low, FT232H_DIV_1MHZ.high);
    await this.session.bulkOut(init);
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

  private async ftdiVendorOut(request: number, value: number): Promise<void> {
    const r = await this.session.controlTransferOut(
      { requestType: "vendor", recipient: "device", request, value, index: FTDI_CTRL_INDEX },
      new Uint8Array(0),
    );
    if (r.status !== "ok") {
      throw new FlashKitError(FlashKitErrorCode.USB_TRANSFER_FAILED, `FTDI control OUT failed: ${r.status}`);
    }
  }

  /** 发送非法命令 `0xAA`，直到收到 `FA AA` 同步序列 */
  private async syncMpsse(): Promise<void> {
    await this.session.bulkOut(new Uint8Array([0xaa]));
    const head = await this.session.bulkInExactly(2);
    if (head[0] !== 0xfa || head[1] !== 0xaa) {
      throw new FlashKitError(FlashKitErrorCode.USB_TRANSFER_FAILED, "FTDI MPSSE sync failed");
    }
  }
}
