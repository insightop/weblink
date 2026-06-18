import type { Transport } from '../../../../transports/types';
import type { ConnectionStatus } from './types';

export type StatusChangeHandler = (status: ConnectionStatus) => void;

/**
 * USB 设备会话管理器（简化版）。
 *
 * 职责：管理设备从「选择 → 连接」的简单生命周期。
 * 设备选择由 HardwareSession 统一管理。
 *
 * 状态机：
 *   idle → pending → selecting → ready
 *   selecting → pending  (用户取消弹窗)
 *   any → failed  (错误)
 */
export class SessionManager {
  private _status: ConnectionStatus = 'idle';
  private _transport: Transport | null = null;

  private _onStatusChange: StatusChangeHandler | null = null;

  get status(): ConnectionStatus {
    return this._status;
  }

  onStatusChange(handler: StatusChangeHandler): void {
    this._onStatusChange = handler;
  }

  async connect(transport: Transport): Promise<void> {
    this._transport = transport;
    this.setState('pending');

    try {
      this.setState('selecting');
      await transport.open();
      this.setState('ready');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('cancelled') || msg.includes('canceled') || msg.includes('Not allowed')) {
        this.setState('pending');
        return;
      }
      this.setState('failed');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this._transport) {
      await this._transport.close().catch(() => undefined);
    }
    this._transport = null;
    this.setState('idle');
  }

  destroy(): void {
    this._transport = null;
    this._onStatusChange = null;
    this._status = 'idle';
  }

  private setState(status: ConnectionStatus): void {
    this._status = status;
    this._onStatusChange?.(status);
  }
}
