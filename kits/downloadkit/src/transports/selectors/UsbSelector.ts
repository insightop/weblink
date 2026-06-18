import type { DeviceSelector } from './DeviceSelector';
import type { HardwareIdentity, HardwareType } from '../HardwareSession.types';

function getNavigatorUsb(): USB | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { usb?: USB }).usb;
}

export class UsbSelector implements DeviceSelector<USBDevice> {
  readonly type: HardwareType = 'usb';

  async request(filters?: USBDeviceFilter[]): Promise<USBDevice> {
    const usb = getNavigatorUsb();
    if (!usb) throw new Error('Web USB is not supported');
    return usb.requestDevice({ filters: filters ?? [] });
  }

  async getGranted(): Promise<USBDevice[]> {
    const usb = getNavigatorUsb();
    if (!usb?.getDevices) return [];
    return usb.getDevices();
  }

  getIdentity(device: USBDevice): HardwareIdentity {
    return {
      type: 'usb',
      usbVendorId: device.vendorId,
      usbProductId: device.productId,
      manufacturerName: device.manufacturerName ?? undefined,
      productName: device.productName ?? undefined,
      serialNumber: device.serialNumber ?? undefined,
    };
  }

  watchDisconnect(_device: USBDevice, _callback: () => void): void {
    // USB 断开检测依赖 navigator.usb 的 disconnect 事件，USBDevice 没有 ondisconnect 属性
  }

  unwatchDisconnect(_device: USBDevice): void {
    // no-op
  }
}
