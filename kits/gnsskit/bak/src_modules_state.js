/**
 * 状态管理模块 - 统一管理应用状态
 */

// 设备状态枚举
export const DeviceStatus = {
  UNKNOWN: "unknown",
  ONLINE: "online",
  OFFLINE: "offline",
};

/**
 * 应用状态对象
 */
export const AppState = {
  // 串口状态
  serial: {
    port: null,
    reader: null,
    writer: null,
    isOpen: false,
  },

  // 设备数据 - Map<uid, DeviceInfo>
  // DeviceInfo: { uid, data, status, lastUpdate }
  devices: new Map(),

  // 发现的UID列表
  discoveredUids: [],

  // UI状态
  ui: {
    selectedUid: null,
    isAutoGetting: false,
    isScanningUids: false,
  },

  // 数据缓冲区
  buffer: "",

  // 定时器
  timers: {
    autoGetData: null,
    dataStatus: null,
    getDataTimeouts: new Map(),
  },
};

/**
 * 获取设备信息
 * @param {string} uid - 设备UID
 * @returns {Object|null} 设备信息
 */
export function getDevice(uid) {
  return AppState.devices.get(uid) || null;
}

/**
 * 设置设备信息
 * @param {string} uid - 设备UID
 * @param {Object} data - 设备数据
 */
export function setDeviceData(uid, data) {
  const existing = AppState.devices.get(uid) || {
    uid,
    status: DeviceStatus.UNKNOWN,
  };

  AppState.devices.set(uid, {
    ...existing,
    uid,
    data,
    lastUpdate: Date.now(),
  });
}

/**
 * 设置设备状态
 * @param {string} uid - 设备UID
 * @param {string} status - 状态
 */
export function setDeviceStatus(uid, status) {
  const existing = AppState.devices.get(uid) || { uid };
  AppState.devices.set(uid, {
    ...existing,
    uid,
    status,
  });
}

/**
 * 添加发现的UID
 * @param {string} uid - 设备UID
 * @returns {boolean} 是否为新发现的UID
 */
export function addDiscoveredUid(uid) {
  if (!AppState.discoveredUids.includes(uid)) {
    AppState.discoveredUids.push(uid);
    // 同时初始化设备状态
    if (!AppState.devices.has(uid)) {
      AppState.devices.set(uid, {
        uid,
        status: DeviceStatus.ONLINE,
      });
    } else {
      setDeviceStatus(uid, DeviceStatus.ONLINE);
    }
    return true;
  }
  return false;
}

/**
 * 清除所有设备数据
 */
export function clearDevices() {
  AppState.devices.clear();
  AppState.discoveredUids = [];
}

/**
 * 获取所有设备数据（用于表格显示）
 * @returns {Array} 设备数据数组
 */
export function getAllDevicesForTable() {
  return AppState.discoveredUids.map((uid) => {
    const device = AppState.devices.get(uid);
    return device || { uid, status: DeviceStatus.UNKNOWN };
  });
}

/**
 * 重置串口状态
 */
export function resetSerialState() {
  AppState.serial.port = null;
  AppState.serial.reader = null;
  AppState.serial.writer = null;
  AppState.serial.isOpen = false;
}

/**
 * 重置UI状态
 */
export function resetUiState() {
  AppState.ui.selectedUid = null;
  AppState.ui.isAutoGetting = false;
  AppState.ui.isScanningUids = false;
}

/**
 * 清除所有定时器
 */
export function clearAllTimers() {
  if (AppState.timers.autoGetData) {
    clearInterval(AppState.timers.autoGetData);
    AppState.timers.autoGetData = null;
  }
  if (AppState.timers.dataStatus) {
    clearTimeout(AppState.timers.dataStatus);
    AppState.timers.dataStatus = null;
  }
  AppState.timers.getDataTimeouts.forEach((timer) => clearTimeout(timer));
  AppState.timers.getDataTimeouts.clear();
}

/**
 * 设置获取数据超时
 * @param {string} uid - 设备UID
 * @param {Function} callback - 超时回调
 * @param {number} timeout - 超时时间
 */
export function setGetDataTimeout(uid, callback, timeout = 3000) {
  // 清除之前的超时
  clearGetDataTimeout(uid);

  const timeoutId = setTimeout(() => {
    callback();
    AppState.timers.getDataTimeouts.delete(uid);
  }, timeout);

  AppState.timers.getDataTimeouts.set(uid, timeoutId);
}

/**
 * 清除获取数据超时
 * @param {string} uid - 设备UID
 */
export function clearGetDataTimeout(uid) {
  if (AppState.timers.getDataTimeouts.has(uid)) {
    clearTimeout(AppState.timers.getDataTimeouts.get(uid));
    AppState.timers.getDataTimeouts.delete(uid);
  }
}
