import type { Transport } from '../types';

export class WebHidTransport implements Transport {
  readonly name = 'web-hid';
  private _device: HIDDevice;

  constructor(device: HIDDevice) {
    this._device = device;
  }

  get device(): HIDDevice {
    return this._device;
  }

  async open(): Promise<void> {
    if (this._device.opened) return;
    await this._device.open();
  }

  async close(): Promise<void> {
    await this._device.close().catch(() => undefined);
  }

  async write(_data: Uint8Array): Promise<void> {
    // Wrapped by higher-level adapters.
  }

  async read(_size: number): Promise<Uint8Array> {
    return new Uint8Array(0);
  }
}
