/**
 * USB 设备会话连接状态。
 *
 * 状态流转：
 *   idle → pending → selecting → ready
 *                               ↘ disconnected → (auto-reconnect) → ready
 *   selecting → pending  (用户取消)
 *   any → failed  (错误)
 */
export type ConnectionStatus =
  | "idle"
  | "pending"        // 用户选中了烧录器，但尚未完成 USB 授权
  | "selecting"      // 浏览器设备弹窗已打开，等待用户选择
  | "ready"          // 设备已连接，可以烧录
  | "disconnected"   // 设备被动物理断开
  | "failed";        // 连接失败

/** 会话生命周期事件（用于测试/日志追溯） */
export type ConnectionEvent =
  | { type: "SELECT" }
  | { type: "DEVICE_CHOSEN" }
  | { type: "DEVICE_CANCELLED" }
  | { type: "DEVICE_CONNECTED" }
  | { type: "DISCONNECTED" }
  | { type: "RECONNECTED" }
  | { type: "ERROR"; error: string };
