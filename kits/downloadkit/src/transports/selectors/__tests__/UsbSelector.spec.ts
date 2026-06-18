import { describe, expect, it } from 'vitest';
import { UsbSelector } from '../UsbSelector';

describe('UsbSelector', () => {
  const selector = new UsbSelector();

  it('type 返回 usb', () => {
    expect(selector.type).toBe('usb');
  });

  it('getIdentity 提取 VID/PID', () => {
    const device = { vendorId: 0x0483, productId: 0x5740 } as USBDevice;
    const id = selector.getIdentity(device);
    expect(id.type).toBe('usb');
    expect(id.usbVendorId).toBe(0x0483);
    expect(id.usbProductId).toBe(0x5740);
  });

  it('watchDisconnect 和 unwatchDisconnect 不抛异常', () => {
    const device = {} as USBDevice;
    expect(() => selector.watchDisconnect(device, () => {})).not.toThrow();
    expect(() => selector.unwatchDisconnect(device)).not.toThrow();
  });
});
