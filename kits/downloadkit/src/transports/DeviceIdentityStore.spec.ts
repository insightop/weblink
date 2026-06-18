import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { DeviceIdentityStore } from './DeviceIdentityStore';
import type { PersistedHardwareIdentity } from './DeviceIdentityStore';

describe('DeviceIdentityStore', () => {
  let store: DeviceIdentityStore;

  beforeEach(() => {
    store = new DeviceIdentityStore();
  });

  afterEach(async () => {
    await store.clear();
  });

  it('初始时加载返回 null', async () => {
    const result = await store.load();
    expect(result).toBeNull();
  });

  it('保存后加载返回相同值', async () => {
    const identity: PersistedHardwareIdentity = {
      type: 'serial',
      usbVendorId: 0x1a86,
      usbProductId: 0x7523,
      lastConfig: { baudRate: 115200 },
    };
    await store.save(identity);
    const loaded = await store.load();
    expect(loaded).toEqual(identity);
  });

  it('覆盖保存后加载返回新值', async () => {
    await store.save({ type: 'serial', usbVendorId: 0xaaaa, usbProductId: 0xbbbb });
    await store.save({ type: 'usb', usbVendorId: 0xcccc, usbProductId: 0xdddd });
    const loaded = await store.load();
    expect(loaded?.type).toBe('usb');
  });

  it('clear 后加载返回 null', async () => {
    await store.save({ type: 'serial' });
    await store.clear();
    const result = await store.load();
    expect(result).toBeNull();
  });
});
