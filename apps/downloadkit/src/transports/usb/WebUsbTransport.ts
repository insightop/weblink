import type { UsbTransport } from "@/transports/types";

export class WebUsbTransport implements UsbTransport {
  readonly name = "web-usb";
  private device: USBDevice | null = null;
  private opened = false;

  constructor(private readonly filters: USBDeviceFilter[] = []) {}

  async selectDevice(): Promise<void> {
    if (!("usb" in navigator)) throw new Error("WebUSB is not supported");
    const usbApi = navigator.usb as USB;
    this.device = await usbApi.requestDevice({ filters: this.filters });
  }

  isDeviceReady(): boolean {
    return Boolean(this.device);
  }

  getDeviceLabel(): string | null {
    if (!this.device) return null;
    return this.device.productName ?? `${this.device.vendorId.toString(16)}:${this.device.productId.toString(16)}`;
  }

  getDeviceDetails(): string[] {
    if (!this.device) return [];
    const details: string[] = [];
    details.push(`VID: 0x${this.device.vendorId.toString(16).padStart(4, "0").toUpperCase()}`);
    details.push(`PID: 0x${this.device.productId.toString(16).padStart(4, "0").toUpperCase()}`);
    if (this.device.manufacturerName) details.push(`MFR: ${this.device.manufacturerName}`);
    if (this.device.productName) details.push(`PRODUCT: ${this.device.productName}`);
    if (this.device.serialNumber) details.push(`SN: ${this.device.serialNumber}`);
    if (this.device.usbVersionMajor != null) {
      details.push(
        `USB: ${this.device.usbVersionMajor}.${String(this.device.usbVersionMinor ?? 0)}.${String(this.device.usbVersionSubminor ?? 0)}`,
      );
    }
    return details;
  }

  async open(): Promise<void> {
    if (!this.device) {
      await this.selectDevice();
    }
    if (!this.device) throw new Error("USB device is not selected");
    if (this.device.opened) {
      this.opened = true;
      return;
    }
    await this.device.open();
    if (!this.device.configuration) await this.device.selectConfiguration(1);
    this.opened = true;
  }

  async releaseSession(): Promise<void> {
    // Keep selected USB device for next download round.
  }

  async close(): Promise<void> {
    if (this.device && this.opened) {
      await this.device.close().catch(() => undefined);
    }
    this.device = null;
    this.opened = false;
  }

  async write(_data: Uint8Array): Promise<void> {
    // Real endpoint writes are protocol-specific and wrapped by adapters.
  }

  async read(_size: number): Promise<Uint8Array> {
    return new Uint8Array(0);
  }

  getDevice(): USBDevice {
    if (!this.device) throw new Error("USB device is not opened");
    return this.device;
  }
}
