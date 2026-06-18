import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach, vi, type Mock } from 'vitest';
import { FlasherSession } from '../FlasherSession';
import type { HardwareType, HardwareIdentity } from '../FlasherSession.types';
import type { DeviceSelector } from '../selectors/DeviceSelector';
import type { Transport } from '../types';
import { DeviceIdentityStore } from '../DeviceIdentityStore';

function makeMockTransport(device?: unknown): Transport {
  let mockPort = device ?? null;
  return {
    name: 'mock-transport',
    get port() {
      return mockPort;
    },
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    write: vi.fn(),
    read: vi.fn(),
  } as unknown as Transport;
}

function makeMockSelector(): DeviceSelector<unknown> {
  return {
    type: 'serial' as HardwareType,
    request: vi.fn().mockRejectedValue(new Error('no default device')),
    getGranted: vi.fn().mockResolvedValue([]),
    getIdentity: vi.fn((_d) => ({ type: 'serial' })),
    watchDisconnect: vi.fn(),
    unwatchDisconnect: vi.fn(),
  };
}

describe('FlasherSession', () => {
  let mockSelector: DeviceSelector<unknown>;
  let mockDevice: object;
  let transports: Transport[];
  let lastConfig: Record<string, unknown> | undefined;

  function createSession() {
    transports = [];
    lastConfig = undefined;
    mockSelector = makeMockSelector();
    mockDevice = { id: 'device-1' };
    (mockSelector.request as Mock).mockResolvedValue(mockDevice);

    return FlasherSession.getInstance({
      createSelector: () => mockSelector,
      createTransport: (_type, device, config) => {
        lastConfig = config;
        const t = makeMockTransport(device);
        transports.push(t);
        return t;
      },
    });
  }

  beforeEach(() => {
    FlasherSession.resetInstance();
  });

  it('初始状态为 idle', () => {
    const session = createSession();
    expect(session.getStatus()).toBe('idle');
  });

  it('acquire 后状态为 ready', async () => {
    const session = createSession();
    const transport = await session.acquire('serial');

    expect(session.getStatus()).toBe('ready');
    expect(transport).toBe(transports[0]);
    expect(transports[0].open).toHaveBeenCalledOnce();
  });

  it('acquire 调用 watchDisconnect', async () => {
    const session = createSession();
    await session.acquire('serial');

    expect(mockSelector.watchDisconnect).toHaveBeenCalledWith(mockDevice, expect.any(Function));
  });

  it('acquire 失败时回到 idle', async () => {
    const session = createSession();
    (mockSelector.request as Mock).mockRejectedValue(new Error('canceled'));

    await expect(session.acquire('serial')).rejects.toThrow('canceled');
    expect(session.getStatus()).toBe('idle');
  });

  it('重复 acquire 抛异常', async () => {
    const session = createSession();
    await session.acquire('serial');
    await expect(session.acquire('serial')).rejects.toThrow('already active');
  });

  it('release 后回到 idle', async () => {
    const session = createSession();
    await session.acquire('serial');
    await session.release();

    expect(session.getStatus()).toBe('idle');
    expect(transports[0].close).toHaveBeenCalledOnce();
  });

  it('release 调用 unwatchDisconnect', async () => {
    const session = createSession();
    await session.acquire('serial');
    await session.release();

    expect(mockSelector.unwatchDisconnect).toHaveBeenCalledWith(mockDevice, expect.any(Function));
  });

  it('reopen 用新配置重建传输', async () => {
    const session = createSession();
    await session.acquire('serial');

    await session.reopen({ baudRate: 9600 });

    expect(lastConfig).toEqual({ baudRate: 9600 });
    expect(transports).toHaveLength(2);
    expect(transports[0].close).toHaveBeenCalledOnce();
    expect(transports[1].open).toHaveBeenCalledOnce();
    expect(session.getStatus()).toBe('ready');
  });

  it('reopen 时没有活跃会话抛异常', async () => {
    const session = createSession();
    await expect(session.reopen({ baudRate: 9600 })).rejects.toThrow('No active session');
  });

  it('断开回调触发状态变化', async () => {
    const session = createSession();

    let disconnectHandler: (() => void) | undefined;
    (mockSelector.watchDisconnect as Mock).mockImplementation((_d, cb) => {
      disconnectHandler = cb;
    });

    const onDisconnect = vi.fn();
    session.onDisconnect(onDisconnect);
    await session.acquire('serial');

    expect(session.getStatus()).toBe('ready');

    disconnectHandler!();
    expect(session.getStatus()).toBe('disconnected');
    expect(onDisconnect).toHaveBeenCalledOnce();
  });

  it('带 identity 时优先匹配已授权设备', async () => {
    const session = createSession();
    (mockSelector.getIdentity as Mock).mockImplementation((d) => ({
      type: 'serial',
      usbVendorId: d.usbVendorId,
      usbProductId: d.usbProductId,
    }));
    (mockSelector.getGranted as Mock).mockResolvedValue([
      { usbVendorId: 0x1234, usbProductId: 0x5678 },
      { usbVendorId: 0xaaaa, usbProductId: 0xbbbb },
    ]);

    await session.acquire('serial', {
      type: 'serial',
      usbVendorId: 0x1234,
      usbProductId: 0x5678,
    });

    expect(mockSelector.request).not.toHaveBeenCalled();
  });

  it('带 identity 但无匹配时 fallback 到 request', async () => {
    const session = createSession();
    (mockSelector.getGranted as Mock).mockResolvedValue([
      { usbVendorId: 0xaaaa, usbProductId: 0xbbbb },
    ]);

    await session.acquire('serial', {
      type: 'serial',
      usbVendorId: 0x1234,
      usbProductId: 0x5678,
    });

    expect(mockSelector.request).toHaveBeenCalledOnce();
  });

  it('clearIdentity 清空持久化记录', async () => {
    const store = new DeviceIdentityStore();
    await store.save({ type: 'serial', usbVendorId: 1, usbProductId: 2 });
    expect(await store.load()).not.toBeNull();

    const session = FlasherSession.getInstance({ store });
    await session.clearIdentity();
    expect(await store.load()).toBeNull();
  });

  it('getInstance 返回同一个实例', () => {
    const a = FlasherSession.getInstance();
    const b = FlasherSession.getInstance();
    expect(a).toBe(b);
  });

  describe('tryRestore', () => {
    it('返回 false 当无存储的 identity', async () => {
      const store = new DeviceIdentityStore();
      const session = FlasherSession.getInstance({ store, createSelector: () => makeMockSelector() });
      const result = await session.tryRestore();
      expect(result).toBe(false);
      expect(session.getStatus()).toBe('idle');
    });

    it('返回 false 当无匹配的已授权设备', async () => {
      const mockSelector = makeMockSelector();
      (mockSelector.getGranted as Mock).mockResolvedValue([]);

      const store = new DeviceIdentityStore();
      await store.save({ type: 'serial', usbVendorId: 0x1234, usbProductId: 0x5678 });

      const session = FlasherSession.getInstance({
        store,
        createSelector: () => mockSelector,
        createTransport: (_t, _d, _c) => makeMockTransport(),
      });
      const result = await session.tryRestore();
      expect(result).toBe(false);
      expect(session.getStatus()).toBe('idle');
    });

    it('返回 true 当匹配到已授权设备并建立连接', async () => {
      const mockDevice = { id: 'device-1', usbVendorId: 0x1234, usbProductId: 0x5678 };
      const mockSelector = makeMockSelector();
      (mockSelector.getGranted as Mock).mockResolvedValue([mockDevice]);
      (mockSelector.getIdentity as Mock).mockImplementation((d) => ({
        type: 'serial',
        usbVendorId: d.usbVendorId,
        usbProductId: d.usbProductId,
      }));

      const store = new DeviceIdentityStore();
      await store.save({ type: 'serial', usbVendorId: 0x1234, usbProductId: 0x5678 });

      const session = FlasherSession.getInstance({
        store,
        createSelector: () => mockSelector,
        createTransport: (_t, _d, _c) => makeMockTransport(),
      });
      const result = await session.tryRestore();
      expect(result).toBe(true);
      expect(session.getStatus()).toBe('ready');
      expect(session.getTransport()).not.toBeNull();
    });

    it('返回 false 当会话已激活', async () => {
      const mockDevice = { id: 'device-1', usbVendorId: 0x1234, usbProductId: 0x5678 };
      const mockSelector = makeMockSelector();
      (mockSelector.request as Mock).mockResolvedValue(mockDevice);

      const store = new DeviceIdentityStore();
      await store.save({ type: 'serial', usbVendorId: 0x1234, usbProductId: 0x5678 });

      const session = FlasherSession.getInstance({
        store,
        createSelector: () => mockSelector,
        createTransport: (_t, _d, _c) => makeMockTransport(),
      });
      await session.acquire('serial');
      expect(session.getStatus()).toBe('ready');

      const result = await session.tryRestore();
      expect(result).toBe(false);
    });
  });
});
