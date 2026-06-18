import { describe, expect, it, vi } from 'vitest';
import { SessionManager } from './SessionManager';
import type { Transport } from '../../../../transports/types';

function createMockTransport(overrides: Partial<Transport> = {}): Transport {
  return {
    name: 'mock-transport',
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    write: vi.fn(),
    read: vi.fn(),
    ...overrides,
  };
}

describe('SessionManager', () => {
  describe('初始状态', () => {
    it('创建时为 idle', () => {
      const sm = new SessionManager();
      expect(sm.status).toBe('idle');
    });
  });

  describe('connect()', () => {
    it('正常流程: pending → selecting → ready', async () => {
      const sm = new SessionManager();
      const transport = createMockTransport();
      const statuses: string[] = [];

      sm.onStatusChange((s) => statuses.push(s));
      await sm.connect(transport);

      expect(statuses).toEqual(['pending', 'selecting', 'ready']);
      expect(sm.status).toBe('ready');
      expect(transport.open).toHaveBeenCalledOnce();
    });

    it('连接失败转为 failed', async () => {
      const sm = new SessionManager();
      const transport = createMockTransport({
        open: vi.fn().mockRejectedValue(new Error('port busy')),
      });

      await expect(sm.connect(transport)).rejects.toThrow('port busy');
      expect(sm.status).toBe('failed');
    });
  });

  describe('disconnect()', () => {
    it('关闭传输并回到 idle', async () => {
      const sm = new SessionManager();
      const transport = createMockTransport();

      await sm.connect(transport);
      expect(sm.status).toBe('ready');

      await sm.disconnect();
      expect(sm.status).toBe('idle');
      expect(transport.close).toHaveBeenCalledOnce();
    });
  });

  describe('destroy()', () => {
    it('清理所有资源', async () => {
      const sm = new SessionManager();
      const transport = createMockTransport();

      await sm.connect(transport);
      sm.destroy();

      expect(sm.status).toBe('idle');
    });
  });
});
