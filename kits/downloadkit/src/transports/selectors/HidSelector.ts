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

  watchDisconnect(_device: HIDDevice, _callback: () => void): void {
    // HID 断开检测依赖 navigator.hid 的 disconnect 事件
  }

  unwatchDisconnect(_device: HIDDevice): void {
    // no-op
  }
}
