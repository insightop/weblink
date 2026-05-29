import type { Transport } from "../../../../transports/types";
import type { ConnectionStatus } from "./types";
import { createSerialReconnectManager, type SerialReconnectManager } from "./serialReconnectManager";

export type StatusChangeHandler = (status: ConnectionStatus) => void;
export type DisconnectHandler = () => void;
export type ReconnectHandler = () => Promise<void>;
/** 设备重连确认：VID/PID 匹配但无法确认是同一设备时，询问用户是否接受重连。 */
export type ConfirmReconnectHandler = (portInfo: string) => Promise<boolean>;

/**
 * USB 设备会话管理器。
 *
 * 职责：管理设备从「选择 → 连接 → 监听 → 断开 → 重连」的全生命周期，
 * 通过回调函数与外部（如 Pinia store）解耦。
 *
 * 状态机：
 *   idle → pending → selecting → ready
 *                               ↘ disconnected → (auto-reconnect) → ready
 *   selecting → pending  (用户取消弹窗)
 *   any → failed  (错误)
 *
 * 对于 WebSerial 等支持重连的传输层，自动创建 SerialReconnectManager
 * 来管理 navigator 级别的事件监听和轮询兜底。
 */
export class SessionManager {
  private _status: ConnectionStatus = "idle";
  private _transport: Transport | null = null;

  private _onStatusChange: StatusChangeHandler | null = null;
  private _onDisconnect: DisconnectHandler | null = null;
  private _onReconnect: ReconnectHandler | null = null;
  private _onConfirmReconnect: ConfirmReconnectHandler | null = null;

  /** 串口重连管理器（当传输层支持时） */
  private _reconnectManager: SerialReconnectManager | null = null;

  /** 当前连接状态（只读） */
  get status(): ConnectionStatus {
    return this._status;
  }

  /** 监听状态变化 */
  onStatusChange(handler: StatusChangeHandler): void {
    this._onStatusChange = handler;
  }

  /** 注册被动断开回调 */
  onDisconnect(handler: DisconnectHandler): void {
    this._onDisconnect = handler;
  }

  /** 注册自动重连回调 */
  onReconnect(handler: ReconnectHandler): void {
    this._onReconnect = handler;
  }

  /** 注册重连确认回调（VID/PID 匹配时询问用户）。 */
  onConfirmReconnect(handler: ConfirmReconnectHandler): void {
    this._onConfirmReconnect = handler;
  }

  /**
   * 启动连接流程。
   * 状态机：pending → selecting → ready
   * 如果用户取消设备弹窗，状态回到 pending。
   */
  async connect(transport: Transport): Promise<void> {
    this._transport = transport;
    this.setState("pending");

    try {
      this.setState("selecting");
      await transport.selectDevice?.();
      await transport.open();
      this.setState("ready");

      // 成功连接后，尝试创建重连管理器
      this.setupReconnectManager(transport);
    } catch (error: unknown) {
      // 用户取消设备弹窗：回到 pending
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("cancelled") || msg.includes("canceled") || msg.includes("Not allowed")) {
        this.setState("pending");
        return;
      }
      this.setState("failed");
      throw error;
    }
  }

  /** 释放当前会话，清理监听器 */
  async disconnect(): Promise<void> {
    this.teardownReconnectManager();
    if (this._transport) {
      await this._transport.close().catch(() => undefined);
    }
    this._transport = null;
    this.setState("idle");
  }

  /** 销毁管理器，清理所有资源 */
  destroy(): void {
    this.teardownReconnectManager();
    this._transport = null;
    this._onStatusChange = null;
    this._onDisconnect = null;
    this._onReconnect = null;
    this._onConfirmReconnect = null;
    this._status = "idle";
  }

  // ── 私有方法 ──

  private setState(status: ConnectionStatus): void {
    this._status = status;
    this._onStatusChange?.(status);
  }

  /**
   * 检查传输层是否支持 ReconnectManager（通过 duck-typing 判断）。
   * 目前支持 WebSerialTransport（具有 `port` 属性和 `replacePort` 方法）。
   */
  private setupReconnectManager(transport: Transport): void {
    const reconnectable = transport as {
      readonly port: SerialPort | null;
      replacePort?: (port: SerialPort) => void;
    };

    if (!("port" in transport) || !reconnectable.replacePort) return;
    if (!reconnectable.port) return;

    this._reconnectManager = createSerialReconnectManager({
      enabled: () => this._status === "ready" || this._status === "disconnected",
      onDisconnect: () => {
        this.setState("disconnected");
        this._onDisconnect?.();
      },
      onReconnect: (newPort: SerialPort) => {
        if (this._status !== "disconnected") return;
        this.setState("selecting");
        reconnectable.replacePort!(newPort);
        transport
          .open()
          .then(() => {
            this.setState("ready");
            return this._onReconnect?.();
          })
          .catch(() => {
            this.setState("failed");
          });
      },
      confirmReconnect: this._onConfirmReconnect
        ? async (port: SerialPort) => {
            const info = port.getInfo?.();
            const label =
              info && typeof info.usbVendorId === "number"
                ? `VID:${info.usbVendorId.toString(16).toUpperCase()} PID:${info.usbProductId?.toString(16).toUpperCase()}`
                : "unknown";
            return this._onConfirmReconnect!(label);
          }
        : undefined,
    });

    this._reconnectManager.rememberPort(reconnectable.port);
    this._reconnectManager.start();

    // I/O 级断开检测：传输层的 read/write 失败（stream closed）时，通过
    // ReconnectManager 触发断开流程。这是最可靠的检测路径（覆盖 navigator 事件不可靠的场景）。
    transport.onDisconnect?.(() => {
      this._reconnectManager?.notifyIoLinkLost();
    });
  }

  private teardownReconnectManager(): void {
    if (this._reconnectManager) {
      this._reconnectManager.stop();
      this._reconnectManager.clearRemembered();
      this._reconnectManager = null;
    }
  }
}
