import type { Transport } from "../types";

export class WebHidTransport implements Transport {
  readonly name = "web-hid";
  private _device: HIDDevice | null = null;

  private _disconnectCallback: (() => void) | null = null;
  private _reconnectCallback: (() => void) | null = null;

  constructor(private readonly filters: HIDDeviceFilter[] = []) {}

  /** 获取底层 HIDDevice 引用（供 ReconnectManager 使用）。 */
  get device(): HIDDevice | null {
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
  replaceDevice(newDevice: HIDDevice): void {
    this._device = newDevice;
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
    if (!("hid" in navigator)) throw new Error("WebHID is not supported");
    const hidApi = navigator.hid as HID;
    const selected = await hidApi.requestDevice({ filters: this.filters });
    this._device = selected[0] ?? null;
  }

  isDeviceReady(): boolean {
    return Boolean(this._device);
  }

  getDeviceLabel(): string | null {
    if (!this._device) return null;
    return this._device.productName ?? "HID device";
  }

  getDeviceDetails(): string[] {
    if (!this._device) return [];
    const details: string[] = [];
    details.push(`VID: 0x${this._device.vendorId.toString(16).padStart(4, "0").toUpperCase()}`);
    details.push(`PID: 0x${this._device.productId.toString(16).padStart(4, "0").toUpperCase()}`);
    if (this._device.productName) details.push(`PRODUCT: ${this._device.productName}`);
    if (this._device.collections?.length) details.push(`COLLECTIONS: ${this._device.collections.length}`);
    return details;
  }

  async open(): Promise<void> {
    if (!this._device) {
      await this.selectDevice();
    }
    if (!this._device) throw new Error("No HID device selected");
    if (this._device.opened) return;
    await this._device.open();
  }

  async releaseSession(): Promise<void> {
    // Keep selected HID device for next download round.
  }

  async close(): Promise<void> {
    this.removeEventListeners();
    await this._device?.close().catch(() => undefined);
    this._device = null;
  }

  async write(_data: Uint8Array): Promise<void> {
    // Wrapped by higher-level adapters.
  }

  async read(_size: number): Promise<Uint8Array> {
    return new Uint8Array(0);
  }
}
