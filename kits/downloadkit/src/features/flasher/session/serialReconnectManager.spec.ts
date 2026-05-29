import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSerialReconnectManager } from "./serialReconnectManager";

/**
 * 模拟 SerialPort 的最小接口。
 * 使用 EventTarget 以便支持对象引用匹配测试。
 */
function makePort(vid?: number, pid?: number): SerialPort {
  // SerialPort 继承 EventTarget，这里用普通对象模拟
  const port = { getInfo: () => ({ usbVendorId: vid, usbProductId: pid }) } as unknown as SerialPort;
  return port;
}

describe("createSerialReconnectManager", () => {
  let serialTarget: EventTarget & { getPorts: ReturnType<typeof vi.fn> };
  let enabled: boolean;

  beforeEach(() => {
    enabled = true;
    serialTarget = new EventTarget() as EventTarget & { getPorts: ReturnType<typeof vi.fn> };
    Object.assign(serialTarget, {
      requestPort: vi.fn(),
      getPorts: vi.fn().mockResolvedValue([]),
    });
    vi.stubGlobal("navigator", { serial: serialTarget });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("断开检测", () => {
    it("port.ondisconnect 直接回调触发 onDisconnect", async () => {
      const port = makePort(0x1234, 0x5678);
      const onDisconnect = vi.fn();
      const mgr = createSerialReconnectManager({
        enabled: () => enabled,
        onDisconnect,
        onReconnect: vi.fn(),
      });
      mgr.rememberPort(port);
      mgr.start();

      // port.ondisconnect 应已被设置
      const handler = (port as unknown as { ondisconnect: (() => void) | null }).ondisconnect;
      expect(handler).toBeInstanceOf(Function);
      handler!();

      expect(onDisconnect).toHaveBeenCalledOnce();
      mgr.stop();
    });

    it("port.ondisconnect 在 stop() 后清除", async () => {
      const port = makePort(0x1234, 0x5678);
      const onDisconnect = vi.fn();
      const mgr = createSerialReconnectManager({
        enabled: () => enabled,
        onDisconnect,
        onReconnect: vi.fn(),
      });
      mgr.rememberPort(port);
      mgr.start();
      mgr.stop();

      // stop 后 ondisconnect 应被清除
      expect((port as unknown as { ondisconnect: unknown }).ondisconnect).toBeNull();

      // 手动调用也不会触发
      const handler = (port as unknown as { ondisconnect: (() => void) | null }).ondisconnect;
      handler?.();
      expect(onDisconnect).not.toHaveBeenCalled();
    });

    it("port.ondisconnect 与 navigator.serial 事件同时触发不会重复通知", async () => {
      const port = makePort(0x1234, 0x5678);
      const onDisconnect = vi.fn();
      const mgr = createSerialReconnectManager({
        enabled: () => enabled,
        onDisconnect,
        onReconnect: vi.fn(),
      });
      mgr.rememberPort(port);
      mgr.start();

      // 先触发 port.ondisconnect
      const handler = (port as unknown as { ondisconnect: (() => void) | null }).ondisconnect;
      handler!();

      // 再触发 navigator.serial disconnect 事件
      const ev = new Event("disconnect");
      Object.defineProperty(ev, "port", { value: port, configurable: true });
      serialTarget.dispatchEvent(ev);

      // 应该只收到一次通知
      expect(onDisconnect).toHaveBeenCalledOnce();
      mgr.stop();
    });

    it("navigator.serial disconnect 事件先触发时 port.ondisconnect 不再重复通知", async () => {
      const port = makePort(0x1234, 0x5678);
      const onDisconnect = vi.fn();
      const mgr = createSerialReconnectManager({
        enabled: () => enabled,
        onDisconnect,
        onReconnect: vi.fn(),
      });
      mgr.rememberPort(port);
      mgr.start();

      // 先触发 navigator.serial disconnect 事件
      const ev = new Event("disconnect");
      Object.defineProperty(ev, "port", { value: port, configurable: true });
      serialTarget.dispatchEvent(ev);
      expect(onDisconnect).toHaveBeenCalledOnce();

      // 再调用 port.ondisconnect
      const handler = (port as unknown as { ondisconnect: (() => void) | null }).ondisconnect;
      handler?.();

      // 不应再次通知
      expect(onDisconnect).toHaveBeenCalledOnce();
      mgr.stop();
    });

    it("serial disconnect 事件触发 onDisconnect", async () => {
      const port = makePort(0x1234, 0x5678);
      const onDisconnect = vi.fn();
      const mgr = createSerialReconnectManager({
        enabled: () => enabled,
        onDisconnect,
        onReconnect: vi.fn(),
      });
      mgr.rememberPort(port);
      mgr.start();

      // dispatch navigator.serial disconnect 事件
      const ev = new Event("disconnect");
      Object.defineProperty(ev, "port", { value: port, configurable: true });
      serialTarget.dispatchEvent(ev);

      expect(onDisconnect).toHaveBeenCalledOnce();
      mgr.stop();
    });

    it("其他设备的断开事件不会触发 onDisconnect（VID/PID 不匹配）", async () => {
      const port = makePort(0x1234, 0x5678);
      const otherPort = makePort(0x9999, 0x8888);
      const onDisconnect = vi.fn();
      const mgr = createSerialReconnectManager({
        enabled: () => enabled,
        onDisconnect,
        onReconnect: vi.fn(),
      });
      mgr.rememberPort(port);
      mgr.start();

      const ev = new Event("disconnect");
      Object.defineProperty(ev, "port", { value: otherPort, configurable: true });
      serialTarget.dispatchEvent(ev);

      expect(onDisconnect).not.toHaveBeenCalled();
      mgr.stop();
    });

    it("stop() 后不再处理断开事件", async () => {
      const port = makePort(0x1234, 0x5678);
      const onDisconnect = vi.fn();
      const mgr = createSerialReconnectManager({
        enabled: () => enabled,
        onDisconnect,
        onReconnect: vi.fn(),
      });
      mgr.rememberPort(port);
      mgr.start();
      mgr.stop();

      const ev = new Event("disconnect");
      Object.defineProperty(ev, "port", { value: port, configurable: true });
      serialTarget.dispatchEvent(ev);

      expect(onDisconnect).not.toHaveBeenCalled();
    });
  });

  describe("重连检测", () => {
    it("serial connect 事件触发 onReconnect（VID/PID 匹配）", async () => {
      const remembered = makePort(0x1111, 0x2222);
      const incoming = makePort(0x1111, 0x2222);
      const onReconnect = vi.fn();
      const mgr = createSerialReconnectManager({
        enabled: () => enabled,
        onDisconnect: vi.fn(),
        onReconnect,
      });
      mgr.rememberPort(remembered);
      mgr.start();

      const ev = new Event("connect");
      Object.defineProperty(ev, "port", { value: incoming, configurable: true });
      serialTarget.dispatchEvent(ev);

      // onReconnect 应该收到新的端口对象
      await vi.waitFor(() => expect(onReconnect).toHaveBeenCalledWith(incoming), { timeout: 500 });
      mgr.stop();
    });

    it("disabled 时不重连", async () => {
      enabled = false;
      const remembered = makePort(1, 2);
      const incoming = makePort(1, 2);
      const onReconnect = vi.fn();
      const mgr = createSerialReconnectManager({
        enabled: () => enabled,
        onDisconnect: vi.fn(),
        onReconnect,
      });
      mgr.rememberPort(remembered);
      mgr.start();

      const ev = new Event("connect");
      Object.defineProperty(ev, "port", { value: incoming, configurable: true });
      serialTarget.dispatchEvent(ev);

      await new Promise((r) => setTimeout(r, 50));
      expect(onReconnect).not.toHaveBeenCalled();
      mgr.stop();
    });

    it("其他设备的 connect 事件不会触发 onReconnect", async () => {
      const remembered = makePort(0x1111, 0x2222);
      const other = makePort(0x3333, 0x4444);
      const onReconnect = vi.fn();
      const mgr = createSerialReconnectManager({
        enabled: () => enabled,
        onDisconnect: vi.fn(),
        onReconnect,
      });
      mgr.rememberPort(remembered);
      mgr.start();

      const ev = new Event("connect");
      Object.defineProperty(ev, "port", { value: other, configurable: true });
      serialTarget.dispatchEvent(ev);

      await new Promise((r) => setTimeout(r, 50));
      expect(onReconnect).not.toHaveBeenCalled();
      mgr.stop();
    });

    it("通过 getPorts 轮询兜底重连", async () => {
      const remembered = makePort(0xabcd, 0x00ef);
      const granted = makePort(0xabcd, 0x00ef);
      const onReconnect = vi.fn();
      const mgr = createSerialReconnectManager({
        enabled: () => true,
        onDisconnect: vi.fn(),
        onReconnect,
        pollIntervalMs: 30,
      });
      mgr.rememberPort(remembered);
      serialTarget.getPorts.mockResolvedValue([granted]);
      mgr.start();

      await vi.waitFor(() => expect(onReconnect).toHaveBeenCalledWith(granted), { timeout: 2000 });
      mgr.stop();
    });
  });

  describe("无 USB 身份的设备（蓝牙串口 / 虚拟 COM 口）", () => {
    it("无 VID/PID 时通过端口引用匹配断开", async () => {
      // getInfo 返回空对象（无 VID/PID）
      const port = { getInfo: () => ({}) } as unknown as SerialPort;
      const onDisconnect = vi.fn();
      const mgr = createSerialReconnectManager({
        enabled: () => enabled,
        onDisconnect,
        onReconnect: vi.fn(),
      });
      mgr.rememberPort(port);
      mgr.start();

      // 断开事件：event.port 与 rememberedPort 是同一对象引用
      const ev = new Event("disconnect");
      Object.defineProperty(ev, "port", { value: port, configurable: true });
      serialTarget.dispatchEvent(ev);

      expect(onDisconnect).toHaveBeenCalledOnce();
      mgr.stop();
    });

    it("无 VID/PID 且 getPorts 只剩一个端口时尝试重连", async () => {
      const rememberedPort = { getInfo: () => ({}) } as unknown as SerialPort;
      const grantedPort = { getInfo: () => ({}) } as unknown as SerialPort;
      const onReconnect = vi.fn();
      const mgr = createSerialReconnectManager({
        enabled: () => true,
        onDisconnect: vi.fn(),
        onReconnect,
        pollIntervalMs: 30,
      });
      mgr.rememberPort(rememberedPort);
      serialTarget.getPorts.mockResolvedValue([grantedPort]);
      mgr.start();

      await vi.waitFor(() => expect(onReconnect).toHaveBeenCalledWith(grantedPort), { timeout: 2000 });
      mgr.stop();
    });
  });

  describe("生命周期管理", () => {
    it("hasRememberedPort 反映是否有记住的端口", () => {
      const mgr = createSerialReconnectManager({
        enabled: () => true,
        onDisconnect: vi.fn(),
        onReconnect: vi.fn(),
      });
      expect(mgr.hasRememberedPort()).toBe(false);
      mgr.rememberPort(makePort(1, 2));
      expect(mgr.hasRememberedPort()).toBe(true);
      mgr.clearRemembered();
      expect(mgr.hasRememberedPort()).toBe(false);
    });

    it("多次 start() 不会重复注册事件", () => {
      const addEventListenerSpy = vi.spyOn(serialTarget, "addEventListener");
      const mgr = createSerialReconnectManager({
        enabled: () => true,
        onDisconnect: vi.fn(),
        onReconnect: vi.fn(),
      });
      mgr.rememberPort(makePort(1, 2));
      mgr.start();
      mgr.start();
      mgr.start();
      // 应该只注册一次 connect + disconnect
      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
      mgr.stop();
    });

    it("rememberPort 在 start() 后调用时设置 ondisconnect", () => {
      const port = makePort(0xaaaa, 0xbbbb);
      const mgr = createSerialReconnectManager({
        enabled: () => true,
        onDisconnect: vi.fn(),
        onReconnect: vi.fn(),
      });
      // 先 start，再 rememberPort
      mgr.start();
      mgr.rememberPort(port);

      // ondisconnect 应被设置
      expect((port as unknown as { ondisconnect: unknown }).ondisconnect).toBeInstanceOf(Function);
      mgr.stop();
    });
  });
});
