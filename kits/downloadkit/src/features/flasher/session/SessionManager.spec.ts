import { describe, expect, it, vi } from "vitest";
import { SessionManager } from "./SessionManager";
import type { Transport } from "../../../../transports/types";

function createMockTransport(overrides: Partial<Transport> = {}): Transport {
  return {
    name: "mock-transport",
    selectDevice: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    write: vi.fn(),
    read: vi.fn(),
    isDeviceReady: vi.fn().mockReturnValue(true),
    getDeviceLabel: vi.fn().mockReturnValue("mock-device"),
    getDeviceDetails: vi.fn().mockReturnValue([]),
    onDisconnect: vi.fn(),
    onReconnect: vi.fn(),
    removeEventListeners: vi.fn(),
    ...overrides,
  };
}

describe("SessionManager", () => {
  describe("初始状态", () => {
    it("创建时为 idle", () => {
      const sm = new SessionManager();
      expect(sm.status).toBe("idle");
    });
  });

  describe("connect()", () => {
    it("正常流程: pending → selecting → ready", async () => {
      const sm = new SessionManager();
      const transport = createMockTransport();
      const statuses: string[] = [];

      sm.onStatusChange((s) => statuses.push(s));
      await sm.connect(transport);

      expect(statuses).toEqual(["pending", "selecting", "ready"]);
      expect(sm.status).toBe("ready");
      expect(transport.selectDevice).toHaveBeenCalledOnce();
      expect(transport.open).toHaveBeenCalledOnce();
    });

    it("用户取消选择时回到 pending", async () => {
      const sm = new SessionManager();
      const transport = createMockTransport({
        selectDevice: vi.fn().mockRejectedValue(new Error("cancelled")),
      });
      const statuses: string[] = [];

      sm.onStatusChange((s) => statuses.push(s));
      await sm.connect(transport);

      expect(statuses).toEqual(["pending", "selecting", "pending"]);
      expect(sm.status).toBe("pending");
    });

    it("Not allowed 错误也视为用户取消，回到 pending", async () => {
      const sm = new SessionManager();
      const transport = createMockTransport({
        selectDevice: vi.fn().mockRejectedValue(new Error("Not allowed")),
      });

      await sm.connect(transport);
      expect(sm.status).toBe("pending");
    });

    it("其他错误转为 failed", async () => {
      const sm = new SessionManager();
      const transport = createMockTransport({
        selectDevice: vi.fn().mockRejectedValue(new Error("port busy")),
      });

      await expect(sm.connect(transport)).rejects.toThrow("port busy");
      expect(sm.status).toBe("failed");
    });
  });

  describe("connect() 无 selectDevice（如 ST-Link 直连）", () => {
    it("跳过 selectDevice 直接 open", async () => {
      const sm = new SessionManager();
      const open = vi.fn().mockResolvedValue(undefined);
      const transport = createMockTransport({
        selectDevice: undefined,
        open,
      });

      await sm.connect(transport);
      expect(sm.status).toBe("ready");
      expect(open).toHaveBeenCalledOnce();
    });
  });

  describe("disconnect()", () => {
    it("关闭传输并回到 idle", async () => {
      const sm = new SessionManager();
      const transport = createMockTransport();

      await sm.connect(transport);
      expect(sm.status).toBe("ready");

      await sm.disconnect();
      expect(sm.status).toBe("idle");
      expect(transport.close).toHaveBeenCalledOnce();
    });
  });

  describe("destroy()", () => {
    it("清理所有资源", async () => {
      const sm = new SessionManager();
      const transport = createMockTransport();

      await sm.connect(transport);
      sm.destroy();

      expect(sm.status).toBe("idle");
    });
  });
});
