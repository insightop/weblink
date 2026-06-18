import type { DeviceSelector } from './DeviceSelector';
import type { HardwareIdentity, HardwareType } from '../HardwareSession.types';

function getNavigatorHid(): HID | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { hid?: HID }).hid;
}

export class HidSelector implements DeviceSelector<HIDDevice> {
  readonly type: HardwareType = 'hid';

  async request(filters?: HIDDeviceFilter[]): Promise<HIDDevice> {
    const hid = getNavigatorHid();
    if (!hid) throw new Error('Web HID is not supported');
    const devices = await hid.requestDevice({ filters: filters ?? [] });
    const device = devices[0];
    if (!device) throw new Error('No HID device selected');
    return device;
  }

  async getGranted(): Promise<HIDDevice[]> {
    const hid = getNavigatorHid();
    if (!hid?.getDevices) return [];
    return hid.getDevices();
  }

  getIdentity(device: HIDDevice): HardwareIdentity {
    return {
      type: 'hid',
      usbVendorId: device.vendorId,
      usbProductId: device.productId,
      productName: device.productName ?? undefined,
    };
  }

  private disconnectHandlers = new WeakMap<HIDDevice, (e: HIDConnectionEvent) => void>();

  watchDisconnect(device: HIDDevice, callback: () => void): void {
    const hid = getNavigatorHid();
    if (!hid) return;
    const handler = (e: HIDConnectionEvent) => {
      if (e.device === device) callback();
    };
    hid.addEventListener('disconnect', handler);
    this.disconnectHandlers.set(device, handler);
  }

  unwatchDisconnect(device: HIDDevice): void {
    const hid = getNavigatorHid();
    if (!hid) return;
    const handler = this.disconnectHandlers.get(device);
    if (handler) {
      hid.removeEventListener('disconnect', handler);
      this.disconnectHandlers.delete(device);
    }
  }
}
