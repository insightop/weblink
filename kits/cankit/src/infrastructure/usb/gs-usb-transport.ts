import { CanKitError } from "../../domain/errors/can-kit-error.js";
import {
  GS_CAN_MODE_NORMAL,
  GS_CAN_MODE_RESET,
  GS_CAN_MODE_START,
  GS_USB_BREQ_BITTIMING,
  GS_USB_BREQ_BT_CONST,
  GS_USB_BREQ_MODE,
} from "../../domain/gsusb/gs-usb-constants.js";
import {
  bitrateToDeviceBittiming,
  packDeviceBittiming,
  packDeviceMode,
} from "../../domain/gsusb/gs-usb-bittiming.js";
import { logDebug } from "../../shared/logger.js";

const CHANNEL = 0;

export class GsUsbTransport {
  private device: USBDevice | null = null;
  private epIn: USBEndpoint | null = null;
  private epOut: USBEndpoint | null = null;
  private fclkCan = 48_000_000;

  getDevice(): USBDevice | null {
    return this.device;
  }

  isOpen(): boolean {
    return this.device != null && this.device.opened;
  }

  private findBulkEndpoints(intf: USBInterface): void {
    const alt = intf.alternates[0];
    if (!alt) {
      throw new CanKitError("USB_CLAIM_FAILED", "接口无 alternate");
    }
    this.epIn = null;
    this.epOut = null;
    for (const ep of alt.endpoints) {
      if (ep.type !== "bulk") continue;
      if (ep.direction === "in" && !this.epIn) this.epIn = ep;
      if (ep.direction === "out" && !this.epOut) this.epOut = ep;
    }
    if (!this.epIn) {
      throw new CanKitError("USB_CLAIM_FAILED", "未找到 Bulk IN 端点");
    }
  }

  async open(device: USBDevice): Promise<void> {
    await device.open();
    const cfgValue = device.configuration?.configurationValue ?? 1;
    if (device.configuration == null) {
      await device.selectConfiguration(cfgValue);
    }
    const cfg = device.configuration;
    if (!cfg?.interfaces[0]) {
      throw new CanKitError("USB_CLAIM_FAILED", "无效 USB 配置");
    }
    const intf = cfg.interfaces[0];
    await device.claimInterface(intf.interfaceNumber);
    this.findBulkEndpoints(intf);
    this.device = device;

    await this.readBtConstFclk();
  }

  private async readBtConstFclk(): Promise<void> {
    if (!this.device) return;
    try {
      const r = await this.device.controlTransferIn(
        {
          requestType: "vendor",
          recipient: "device",
          request: GS_USB_BREQ_BT_CONST,
          value: CHANNEL,
          index: 0,
        },
        40,
      );
      if (r.status !== "ok" || !r.data || r.data.byteLength < 8) return;
      const fclk = r.data.getUint32(4, true);
      if (fclk > 0) {
        this.fclkCan = fclk;
        logDebug("gs_usb fclk_can", fclk);
      }
    } catch {
      this.fclkCan = 48_000_000;
    }
  }

  async configureBitrate(bitrate: number): Promise<void> {
    const timing = bitrateToDeviceBittiming(bitrate, this.fclkCan);
    if (!timing) {
      throw new CanKitError(
        "GSUSB_UNSUPPORTED_BITRATE",
        `不支持的比特率 ${bitrate} @ ${this.fclkCan}Hz，请换 125k/250k/500k/1M 等常见值`,
      );
    }
    if (!this.device) {
      throw new CanKitError("PORT_NOT_OPEN", "USB 未打开");
    }
    const payload = packDeviceBittiming(timing);
    const out = await this.device.controlTransferOut(
      {
        requestType: "vendor",
        recipient: "device",
        request: GS_USB_BREQ_BITTIMING,
        value: CHANNEL,
        index: 0,
      },
      payload,
    );
    if (out.status !== "ok") {
      throw new CanKitError("USB_TRANSFER", "BITTIMING 控制传输失败");
    }
  }

  async startChannel(): Promise<void> {
    if (!this.device) throw new CanKitError("PORT_NOT_OPEN", "USB 未打开");
    const payload = packDeviceMode(GS_CAN_MODE_START, GS_CAN_MODE_NORMAL);
    const out = await this.device.controlTransferOut(
      {
        requestType: "vendor",
        recipient: "device",
        request: GS_USB_BREQ_MODE,
        value: CHANNEL,
        index: 0,
      },
      payload,
    );
    if (out.status !== "ok") {
      throw new CanKitError("USB_TRANSFER", "MODE START 失败");
    }
  }

  async resetChannel(): Promise<void> {
    if (!this.device?.opened) return;
    try {
      const payload = packDeviceMode(GS_CAN_MODE_RESET, 0);
      await this.device.controlTransferOut(
        {
          requestType: "vendor",
          recipient: "device",
          request: GS_USB_BREQ_MODE,
          value: CHANNEL,
          index: 0,
        },
        payload,
      );
    } catch {
      /* ignore */
    }
  }

  async readBulkPacket(length: number): Promise<USBInTransferResult> {
    if (!this.device || !this.epIn) {
      throw new CanKitError("PORT_NOT_OPEN", "USB 未就绪");
    }
    return this.device.transferIn(this.epIn.endpointNumber, length);
  }

  getBulkInPacketSize(): number {
    return this.epIn?.packetSize ?? 64;
  }

  async writeBulk(data: BufferSource): Promise<void> {
    if (!this.device || !this.epOut) {
      throw new CanKitError("PORT_NOT_OPEN", "Bulk OUT 不可用（固件可能仅支持接收）");
    }
    const out = await this.device.transferOut(this.epOut.endpointNumber, data);
    if (out.status !== "ok") {
      throw new CanKitError("USB_TRANSFER", "Bulk OUT 失败");
    }
  }

  async close(): Promise<void> {
    await this.resetChannel();
    const dev = this.device;
    this.device = null;
    this.epIn = null;
    this.epOut = null;
    if (dev?.opened) {
      try {
        const n = dev.configuration?.interfaces[0]?.interfaceNumber ?? 0;
        await dev.releaseInterface(n);
      } catch {
        /* ignore */
      }
      try {
        await dev.close();
      } catch {
        /* ignore */
      }
    }
  }
}
