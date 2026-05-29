import type { UsbTransport } from "../types";

export class WebUsbTransport implements UsbTransport {
  readonly name = "web-usb";
  private _device: USBDevice | null = null;
  private opened = false;

  private _disconnectCallback: (() => void) | null = null;
  private _reconnectCallback: (() => void) | null = null;

  constructor(private readonly filters: USBDeviceFilter[] = []) {}

  /** 获取底层 USBDevice 引用（供 ReconnectManager 使用）。 */
  get device(): USBDevice | null {
    return this._device;
  }

  onDisconnect(cb: () => void): void {
    this._disconnectCallback = cb;
  }

  onReconnect(cb: () => void): void {
    this._reconnectCallback = cb;
  }

  removeEventListeners(): void {
    this._disconnectCallback = null;
    this._reconnectCallback = null;
  }

  /** 替换底层设备引用，供 ReconnectManager 在设备重连后调用。 */
  replaceDevice(newDevice: USBDevice): void {
    this._device = newDevice;
    this.opened = false;
  }

  /** 触发断开回调，供 ReconnectManager 调用。 */
  notifyDisconnect(): void {
    this._disconnectCallback?.();
  }

  /** 触发重连回调，供 ReconnectManager 调用。 */
  notifyReconnect(): void {
    this._reconnectCallback?.();
  }

  async selectDevice(): Promise<void> {
    if (!("usb" in navigator)) throw new Error("WebUSB is not supported");
    const usbApi = navigator.usb as USB;
    this._device = await usbApi.requestDevice({ filters: this.filters });
  }

  isDeviceReady(): boolean {
    return Boolean(this._device);
  }

  getDeviceLabel(): string | null {
    if (!this._device) return null;
    return this._device.productName ?? `${this._device.vendorId.toString(16)}:${this._device.productId.toString(16)}`;
  }

  getDeviceDetails(): string[] {
    if (!this._device) return [];
    const details: string[] = [];
    details.push(`VID: 0x${this._device.vendorId.toString(16).padStart(4, "0").toUpperCase()}`);
    details.push(`PID: 0x${this._device.productId.toString(16).padStart(4, "0").toUpperCase()}`);
    if (this._device.manufacturerName) details.push(`MFR: ${this._device.manufacturerName}`);
    if (this._device.productName) details.push(`PRODUCT: ${this._device.productName}`);
    if (this._device.serialNumber) details.push(`SN: ${this._device.serialNumber}`);
    if (this._device.usbVersionMajor != null) {
      details.push(
        `USB: ${this._device.usbVersionMajor}.${String(this._device.usbVersionMinor ?? 0)}.${String(this._device.usbVersionSubminor ?? 0)}`,
      );
    }
    return details;
  }

  async open(): Promise<void> {
    if (!this._device) {
      await this.selectDevice();
    }
    if (!this._device) throw new Error("USB device is not selected");
    if (this._device.opened) {
      this.opened = true;
      return;
    }
    await this._device.open();
    if (!this._device.configuration) await this._device.selectConfiguration(1);
    this.opened = true;
  }

  async releaseSession(): Promise<void> {
    // Keep selected USB device for next download round.
  }

  async close(): Promise<void> {
    this.removeEventListeners();
    if (this._device && this.opened) {
      await this._device.close().catch(() => undefined);
    }
    this._device = null;
    this.opened = false;
  }

  async write(_data: Uint8Array): Promise<void> {
    // Real endpoint writes are protocol-specific and wrapped by adapters.
  }

  async read(_size: number): Promise<Uint8Array> {
    return new Uint8Array(0);
  }

  getDevice(): USBDevice {
    if (!this._device) throw new Error("USB device is not opened");
    return this._device;
  }
}
