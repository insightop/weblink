import type { Transport } from "@/transports/types";

export class WebHidTransport implements Transport {
  readonly name = "web-hid";
  private device: HIDDevice | null = null;

  constructor(private readonly filters: HIDDeviceFilter[] = []) {}

  async selectDevice(): Promise<void> {
    if (!("hid" in navigator)) throw new Error("WebHID is not supported");
    const hidApi = navigator.hid as HID;
    const selected = await hidApi.requestDevice({ filters: this.filters });
    this.device = selected[0] ?? null;
  }

  isDeviceReady(): boolean {
    return Boolean(this.device);
  }

  getDeviceLabel(): string | null {
    if (!this.device) return null;
    return this.device.productName ?? "HID device";
  }

  getDeviceDetails(): string[] {
    if (!this.device) return [];
    const details: string[] = [];
    details.push(`VID: 0x${this.device.vendorId.toString(16).padStart(4, "0").toUpperCase()}`);
    details.push(`PID: 0x${this.device.productId.toString(16).padStart(4, "0").toUpperCase()}`);
    if (this.device.productName) details.push(`PRODUCT: ${this.device.productName}`);
    if (this.device.collections?.length) details.push(`COLLECTIONS: ${this.device.collections.length}`);
    return details;
  }

  async open(): Promise<void> {
    if (!this.device) {
      await this.selectDevice();
    }
    if (!this.device) throw new Error("No HID device selected");
    if (this.device.opened) return;
    await this.device.open();
  }

  async releaseSession(): Promise<void> {
    // Keep selected HID device for next download round.
  }

  async close(): Promise<void> {
    await this.device?.close().catch(() => undefined);
    this.device = null;
  }

  async write(_data: Uint8Array): Promise<void> {
    // Wrapped by higher-level adapters.
  }

  async read(_size: number): Promise<Uint8Array> {
    return new Uint8Array(0);
  }
}
