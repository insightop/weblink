/**
 * WebSerial 设备的重连管理器。
 *
 * 严格遵循 modbus-io-webserial 的 `createWebSerialReconnectManager` 模式：
 * - 在 `navigator.serial` 级别监听 connect/disconnect 事件（不依赖 port 对象生命周期）
 * - 通过 USB 身份（VID/PID）匹配确认是同一个设备
 * - 轮询 `navigator.serial.getPorts()` 作为兜底（connect 事件不可靠时）
 * - 完全独立于 Transport，只负责事件监听 + 身份匹配 + 回调通知
 *
 * 增强：增加 port.ondisconnect 直接回调作为第二检测层，
 * 覆盖 navigator.serial 事件不可靠的场景（某些 USB 转串口适配器/浏览器不触发全局事件）。
 */

/** 串口端口的 USB 身份标识。 */
export type SerialPortIdentity = {
  usbVendorId?: number;
  usbProductId?: number;
};

/** 使用全局 navigator.serial 的迷你接口（避免依赖完整 DOM 类型）。 */
interface NavigatorSerialLike extends EventTarget {
  addEventListener(
    type: "connect" | "disconnect",
    listener: (ev: Event) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: "connect" | "disconnect",
    listener: (ev: Event) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  getPorts(): Promise<SerialPortLike[]>;
}

interface SerialPortLike {
  getInfo?(): { usbVendorId?: number; usbProductId?: number };
}

function getWebSerial(): NavigatorSerialLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { serial?: NavigatorSerialLike }).serial;
}

function getPortIdentity(port: SerialPortLike): SerialPortIdentity {
  const info = port.getInfo?.();
  if (!info) return {};
  return {
    usbVendorId: typeof info.usbVendorId === "number" ? info.usbVendorId : undefined,
    usbProductId: typeof info.usbProductId === "number" ? info.usbProductId : undefined,
  };
}

function identityHasUsbIds(id: SerialPortIdentity): boolean {
  return id.usbVendorId != null && id.usbProductId != null;
}

function identitiesMatch(a: SerialPortIdentity, b: SerialPortIdentity): boolean {
  if (!identityHasUsbIds(a) || !identityHasUsbIds(b)) return false;
  return a.usbVendorId === b.usbVendorId && a.usbProductId === b.usbProductId;
}

export type SerialReconnectManagerOptions = {
  enabled: () => boolean;
  onDisconnect: () => void;
  onReconnect: (port: SerialPort) => void;
  /** getPorts() 轮询间隔；connect 事件不可靠时的兜底（毫秒）。 */
  pollIntervalMs?: number;
};

export type SerialReconnectManager = {
  rememberPort(port: SerialPort): void;
  clearRemembered(): void;
  start(): void;
  stop(): void;
  hasRememberedPort(): boolean;
  /** I/O 操作失败（stream closed）时通知管理器，触发断开流程。 */
  notifyIoLinkLost(): void;
};

export function createSerialReconnectManager(
  opts: SerialReconnectManagerOptions,
): SerialReconnectManager {
  let rememberedPort: SerialPort | null = null;
  let rememberedIdentity: SerialPortIdentity | null = null;
  let started = false;
  let reconnecting = false;
  /** 护板标志：防止 navigator.serial 事件与 port.ondisconnect 同时触发导致重复通知。 */
  let disconnected = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  const pollIntervalMs = opts.pollIntervalMs ?? 1000;

  // ----- 共享的断开逻辑 -----

  const handleDisconnect = () => {
    if (!started || disconnected) return;
    disconnected = true;
    rememberedPort = null;
    opts.onDisconnect();
  };

  // ----- 事件处理器 -----

  const onConnect = (ev: Event) => {
    if (!started || !opts.enabled() || reconnecting) return;
    // navigator.serial connect 事件通过 SerialConnectionEvent.port 传递端口
    const port = (ev as unknown as { port: SerialPort }).port;
    if (port == null || !rememberedIdentity) return;
    if (!portsMatch(rememberedIdentity, port, rememberedPort)) return;
    void runReconnect(port);
  };

  const onDisconnect = (ev: Event) => {
    if (!started || !rememberedIdentity) return;
    const port = (ev as unknown as { port: SerialPort }).port;
    if (port == null) return;
    if (!portsMatch(rememberedIdentity, port, rememberedPort)) return;
    handleDisconnect();
  };

  /** port.ondisconnect 直接回调（不依赖 navigator.serial 事件）。 */
  const onPortDisconnect = () => {
    handleDisconnect();
  };

  async function runReconnect(port: SerialPort) {
    if (reconnecting) return;
    reconnecting = true;
    try {
      disconnected = false;
      rememberedPort = port;
      // 为新端口注册断开直接回调
      setupPortDisconnect(port);
      opts.onReconnect(port);
    } finally {
      reconnecting = false;
    }
  }

  /** 当 I/O 操作失败（stream closed）时由传输层调用。这是最可靠的断开检测路径。 */
  const onIoLinkLost = () => {
    handleDisconnect();
  };

  /** 在端口对象上设置 ondisconnect 直接回调。 */
  function setupPortDisconnect(port: SerialPort): void {
    try {
      (port as unknown as { ondisconnect: ((ev: Event) => void) | null }).ondisconnect = onPortDisconnect;
    } catch {
      // 某些环境可能不支持 ondisconnect 属性
    }
  }

  /** 清除端口对象上的 ondisconnect 回调。 */
  function teardownPortDisconnect(port: SerialPort): void {
    try {
      (port as unknown as { ondisconnect: ((ev: Event) => void) | null }).ondisconnect = null;
    } catch {
      // ignore
    }
  }

  // ----- 身份匹配 -----

  function portsMatch(
    remembered: SerialPortIdentity,
    port: SerialPortLike,
    rememberedPortRef?: SerialPortLike | null,
  ): boolean {
    // 同一对象引用（适用于断开事件，该端口对象尚未被回收）
    if (rememberedPortRef != null && rememberedPortRef === port) return true;
    const other = getPortIdentity(port);
    // 有 USB 身份时严格按 VID/PID 匹配
    if (identityHasUsbIds(remembered) && identityHasUsbIds(other)) {
      return identitiesMatch(remembered, other);
    }
    // 无 USB 身份时再用引用检查一次（兜底）
    if (rememberedPortRef != null && rememberedPortRef === port) return true;
    return false;
  }

  // ----- 轮询兜底 -----

  async function scanGrantedPortsForReconnect() {
    if (!started || !opts.enabled() || reconnecting || !rememberedIdentity) return;
    const serial = getWebSerial();
    if (!serial?.getPorts) return;
    try {
      const granted = await serial.getPorts();
      for (const candidate of granted) {
        if (portsMatch(rememberedIdentity, candidate, rememberedPort)) {
          void runReconnect(candidate as unknown as SerialPort);
          return;
        }
      }
      // 无 USB 身份且只剩一个已授权端口时，尝试用它重连
      if (!identityHasUsbIds(rememberedIdentity) && granted.length === 1) {
        void runReconnect(granted[0] as unknown as SerialPort);
      }
    } catch {
      // 忽略轮询错误
    }
  }

  // ----- API -----

  return {
    rememberPort(port: SerialPort) {
      rememberedPort = port;
      rememberedIdentity = getPortIdentity(port);
      disconnected = false;
      if (started) {
        setupPortDisconnect(port);
      }
    },

    clearRemembered() {
      rememberedPort = null;
      rememberedIdentity = null;
      disconnected = false;
    },

    hasRememberedPort() {
      return rememberedIdentity != null;
    },

    /** I/O 操作失败（stream closed）时通知管理器：这是最可靠的断开检测路径。 */
    notifyIoLinkLost() {
      onIoLinkLost();
    },

    start() {
      if (started) return;
      started = true;
      disconnected = false;
      const serial = getWebSerial();
      if (serial?.addEventListener) {
        serial.addEventListener("connect", onConnect);
        serial.addEventListener("disconnect", onDisconnect);
      }
      // 端口级断开直接回调（即使 navigator.serial 事件不可靠也能检测）
      if (rememberedPort) {
        setupPortDisconnect(rememberedPort);
      }
      // 可能设备已经插回：启动时立即扫描一次
      void scanGrantedPortsForReconnect();
      // 轮询兜底
      pollTimer = setInterval(() => void scanGrantedPortsForReconnect(), pollIntervalMs);
    },

    stop() {
      if (!started) return;
      started = false;
      reconnecting = false;
      disconnected = false;
      if (pollTimer != null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      const serial = getWebSerial();
      if (serial?.removeEventListener) {
        serial.removeEventListener("connect", onConnect);
        serial.removeEventListener("disconnect", onDisconnect);
      }
      if (rememberedPort) {
        teardownPortDisconnect(rememberedPort);
      }
    },
  };
}
