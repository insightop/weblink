import type { UsbTransport } from '../types';

export class WebUsbTransport implements UsbTransport {
  readonly name = 'web-usb';
  private _device: USBDevice;

  constructor(device: USBDevice) {
    this._device = device;
  }

  get device(): USBDevice {
    return this._device;
  }

  async open(): Promise<void> {
    if (this._device.opened) return;
    await this._device.open();
    if (!this._device.configuration) await this._device.selectConfiguration(1);
  }

  async close(): Promise<void> {
    await this._device.close().catch(() => undefined);
  }

  async write(_data: Uint8Array): Promise<void> {
    // Real endpoint writes are protocol-specific and wrapped by adapters.
  }

  async read(_size: number): Promise<Uint8Array> {
    return new Uint8Array(0);
  }

  getDevice(): USBDevice {
    return this._device;
  }
}
