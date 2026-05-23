import { FlashKitError, FlashKitErrorCode } from "../../domain/errors/FlashKitError";
import { USB_BULK_IN_EP, USB_BULK_OUT_EP } from "./WebUsbTypes";

const USB_TIMEOUT_MS = 1000;

function assertUsbSupported(): void {
  if (!("usb" in navigator)) {
    throw new FlashKitError(FlashKitErrorCode.USB_NOT_SUPPORTED, "WebUSB is not supported in this browser");
  }
}

export class WebUsbSession {
  private device: USBDevice | null = null;
  private interfaceNumber = 0;
  private epOut: USBEndpoint | null = null;
  private epIn: USBEndpoint | null = null;

  getDevice(): USBDevice | null {
    return this.device;
  }

  getInterfaceNumber(): number {
    return this.interfaceNumber;
  }

  async requestDevice(filters: USBDeviceFilter[]): Promise<USBDevice> {
    assertUsbSupported();
    const usb = navigator.usb as USB;
    this.device = await usb.requestDevice({ filters });
    return this.device;
  }

  setDevice(device: USBDevice): void {
    this.device = device;
  }

  async open(): Promise<void> {
    const dev = this.device;
    if (!dev) {
      throw new FlashKitError(FlashKitErrorCode.DEVICE_NOT_SELECTED, "USB device is not selected");
    }
    if (!dev.opened) {
      await dev.open();
    }
    if (!dev.configuration) {
      await dev.selectConfiguration(1);
    }
    const iface = dev.configuration!.interfaces[0];
    this.interfaceNumber = iface.interfaceNumber;
    await dev.claimInterface(this.interfaceNumber);

    const alt = iface.alternates[0];
    const eps = alt.endpoints;
    const out = eps.find((e) => e.type === "bulk" && e.direction === "out");
    const inn = eps.find((e) => e.type === "bulk" && e.direction === "in");
    if (!out || !inn) {
      throw new FlashKitError(
        FlashKitErrorCode.USB_TRANSFER_FAILED,
        "Bulk IN/OUT endpoints not found on interface 0",
      );
    }
    if (out.endpointNumber !== USB_BULK_OUT_EP || inn.endpointNumber !== USB_BULK_IN_EP) {
      // 仍使用找到的端点，但记录期望 CH341 的 0x02 / 0x82
    }
    this.epOut = out;
    this.epIn = inn;
  }

  /**
   * 释放接口并 `device.close()`，但保留 `USBDevice` 引用以便同一授权下再次 `open()`（切换总线/桥时无需重新插拔）。
   */
  async close(): Promise<void> {
    const dev = this.device;
    if (dev?.opened) {
      try {
        await dev.releaseInterface(this.interfaceNumber);
      } catch {
        /* ignore */
      }
      await dev.close().catch(() => undefined);
    }
    this.epOut = null;
    this.epIn = null;
  }

  clearDevice(): void {
    this.device = null;
    this.epOut = null;
    this.epIn = null;
  }

  async bulkOut(data: Uint8Array): Promise<void> {
    const dev = this.device;
    const ep = this.epOut;
    if (!dev || !ep) {
      throw new FlashKitError(FlashKitErrorCode.DEVICE_NOT_SELECTED, "USB device is not open");
    }
    const result = await dev.transferOut(ep.endpointNumber, new Uint8Array(data));
    if (result.status !== "ok") {
      throw new FlashKitError(
        FlashKitErrorCode.USB_TRANSFER_FAILED,
        `USB bulk OUT failed: ${result.status}`,
      );
    }
  }

  /**
   * 聚合读取；FTDI/CP2130 等可一次返回较大包，上限取 512 以兼容常见 MaxPacket。
   */
  async controlTransferOut(params: USBControlTransferParameters, data?: Uint8Array): Promise<USBOutTransferResult> {
    const dev = this.device;
    if (!dev) {
      throw new FlashKitError(FlashKitErrorCode.DEVICE_NOT_SELECTED, "USB device is not open");
    }
    const buf = data ? new Uint8Array(data) : new Uint8Array(0);
    return await dev.controlTransferOut(params, buf);
  }

  async controlTransferIn(params: USBControlTransferParameters, length: number): Promise<USBInTransferResult> {
    const dev = this.device;
    if (!dev) {
      throw new FlashKitError(FlashKitErrorCode.DEVICE_NOT_SELECTED, "USB device is not open");
    }
    return await dev.controlTransferIn(params, length);
  }

  async bulkInExactly(total: number): Promise<Uint8Array> {
    const dev = this.device;
    const ep = this.epIn;
    if (!dev || !ep) {
      throw new FlashKitError(FlashKitErrorCode.DEVICE_NOT_SELECTED, "USB device is not open");
    }
    if (total === 0) {
      return new Uint8Array(0);
    }
    const out = new Uint8Array(total);
    let offset = 0;
    while (offset < total) {
      const chunk = Math.min(512, total - offset);
      const res = await dev.transferIn(ep.endpointNumber, chunk);
      if (res.status !== "ok" || !res.data) {
        throw new FlashKitError(
          FlashKitErrorCode.USB_TRANSFER_FAILED,
          `USB bulk IN failed: ${res.status}`,
        );
      }
      const buf = new Uint8Array(res.data.buffer, res.data.byteOffset, res.data.byteLength);
      if (buf.length === 0) {
        throw new FlashKitError(FlashKitErrorCode.USB_TRANSFER_FAILED, "USB bulk IN returned 0 bytes");
      }
      out.set(buf, offset);
      offset += buf.length;
    }
    return out;
  }
}

export function getUsbTimeoutMs(): number {
  return USB_TIMEOUT_MS;
}
