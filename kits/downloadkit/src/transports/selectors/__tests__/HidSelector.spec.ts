import { describe, expect, it } from 'vitest';
import { HidSelector } from '../HidSelector';

describe('HidSelector', () => {
  const selector = new HidSelector();

  it('type 返回 hid', () => {
    expect(selector.type).toBe('hid');
  });

  it('getIdentity 提取 VID/PID', () => {
    const device = { vendorId: 0xcafe, productId: 0xbabe } as HIDDevice;
    const id = selector.getIdentity(device);
    expect(id.type).toBe('hid');
    expect(id.usbVendorId).toBe(0xcafe);
    expect(id.usbProductId).toBe(0xbabe);
  });

  it('watchDisconnect 和 unwatchDisconnect 不抛异常', () => {
    const device = {} as HIDDevice;
    expect(() => selector.watchDisconnect(device, () => {})).not.toThrow();
    expect(() => selector.unwatchDisconnect(device)).not.toThrow();
  });
});
