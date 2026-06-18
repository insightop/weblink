import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach, vi, type Mock } from 'vitest';
import { HardwareSession } from '../HardwareSession';
import type { SessionStatus, HardwareType, HardwareIdentity } from '../HardwareSession.types';
import type { DeviceSelector } from '../selectors/DeviceSelector';
import type { Transport } from '../types';
import { DeviceIdentityStore } from '../DeviceIdentityStore';

function makeMockTransport(): Transport {
  return {
    name: 'mock-transport',
    open: vi.fn(),
    close: vi.fn(),
    write: vi.fn(),
    read: vi.fn(),
  } as unknown as Transport;
}

function makeSerialMockTransport() {
  let mockPort: unknown = null;
  return {
    name: 'mock-serial',
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    write: vi.fn(),
    read: vi.fn(),
    get port() { return mockPort; },
    replacePort: vi.fn((p: unknown) => { mockPort = p; }),
  };
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

describe('HardwareSession', () => {
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

    return HardwareSession.getInstance({
      createSelector: () => mockSelector,
      createTransport: (_type, config) => {
        lastConfig = config;
        const t = makeSerialMockTransport();
        transports.push(t);
        return t as unknown as Transport;
      },
    });
  }

  beforeEach(() => {
    HardwareSession.resetInstance();
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
    const matching = { usbVendorId: 0x1234, usbProductId: 0x5678 };
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

    const session = HardwareSession.getInstance({ store });
    await session.clearIdentity();
    expect(await store.load()).toBeNull();
  });

  it('getInstance 返回同一个实例', () => {
    const a = HardwareSession.getInstance();
    const b = HardwareSession.getInstance();
    expect(a).toBe(b);
  });
});
