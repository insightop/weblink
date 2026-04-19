/**
 * 格式化工具函数
 */

/**
 * 格式化时间（秒转换为时分秒）
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时间字符串
 */
export function formatTime(seconds) {
  if (seconds == null || isNaN(seconds)) return "--";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}时${minutes}分${remainingSeconds}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${remainingSeconds}秒`;
  } else {
    return `${remainingSeconds}秒`;
  }
}

/**
 * 格式化距离（米转换为公里）
 * @param {number|string} meters - 米数
 * @returns {string} 格式化后的距离字符串
 */
export function formatDistance(meters) {
  // 处理字符串 NaN
  if (meters === "nan" || meters === "-nan" || meters === "NaN" || meters === "-NaN") {
    return meters;
  }

  const num = Number(meters);
  if (isNaN(num) || !isFinite(num)) {
    return "nan";
  }

  if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}公里`;
  }
  return `${num}米`;
}

/**
 * 格式化时间戳
 * @returns {string} 当前时间字符串
 */
export function formatTimestamp() {
  return new Date().toLocaleString();
}

/**
 * 格式化时间（仅时间部分，含毫秒）
 * @returns {string} 当前时间字符串，格式如 14:30:25.123
 */
export function formatTimeOnly() {
  const now = new Date();
  const time = now.toLocaleTimeString();
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${time}.${ms}`;
}

/**
 * 格式化时间为 HH:mm:ss.SSS（24 小时，毫秒）
 * @param {Date} [date] - 可选，默认当前时间
 * @returns {string} 如 14:30:25.123
 */
export function formatTimeWithMs(date = new Date()) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

/**
 * 格式化 GNSS 定位模式
 * @param {number} mode - 定位模式 (1=无定位, 2=2D, 3=3D)
 * @returns {string} 格式化后的定位模式字符串
 */
export function formatFixMode(mode) {
  const modes = {
    0: "未知",
    1: "搜星中",
    2: "2D定位",
    3: "3D定位",
  };
  return modes[mode] || "未知";
}

/**
 * 格式化 GNSS 定位模式（带样式类名）
 * @param {number} mode - 定位模式
 * @returns {object} { text: string, className: string }
 */
export function formatFixModeWithStyle(mode) {
  switch (mode) {
    case 3:
      return { text: "3D定位", className: "fix-3d" };
    case 2:
      return { text: "2D定位", className: "fix-2d" };
    case 1:
    default:
      return { text: "搜星中", className: "fix-searching" };
  }
}

/**
 * 格式化信号强度（CN0）
 * @param {number} cn0 - 信噪比 (dB)
 * @returns {string} 信号强度描述
 */
export function formatSignalStrength(cn0) {
  if (cn0 == null || cn0 <= 0) return "无信号";
  if (cn0 >= 40) return "优秀";
  if (cn0 >= 30) return "良好";
  if (cn0 >= 20) return "一般";
  return "弱";
}

/**
 * 格式化信号强度（带颜色样式）
 * @param {number} cn0 - 信噪比 (dB)
 * @returns {object} { text: string, className: string, color: string }
 */
export function formatSignalStrengthWithStyle(cn0) {
  if (cn0 == null || cn0 <= 0) {
    return { text: "无", className: "signal-none", color: "#999" };
  }
  if (cn0 >= 40) {
    return { text: `${cn0}dB`, className: "signal-excellent", color: "#4caf50" };
  }
  if (cn0 >= 30) {
    return { text: `${cn0}dB`, className: "signal-good", color: "#8bc34a" };
  }
  if (cn0 >= 20) {
    return { text: `${cn0}dB`, className: "signal-fair", color: "#ff9800" };
  }
  return { text: `${cn0}dB`, className: "signal-weak", color: "#f44336" };
}

/**
 * 格式化卫星数量
 * @param {number} visible - 可见卫星数
 * @param {number} used - 使用卫星数
 * @returns {string} 格式化的卫星数量字符串
 */
export function formatSatellites(visible, used) {
  if (visible == null && used == null) return "--";
  const v = visible ?? 0;
  const u = used ?? 0;
  return `${u}/${v}`;
}

/**
 * 格式化速度（m/s 转 km/h）
 * @param {number} mps - 米/秒
 * @returns {string} 格式化的速度字符串
 */
export function formatSpeed(mps) {
  if (mps == null || isNaN(mps)) return "--";
  const kmh = mps * 3.6;
  return `${kmh.toFixed(1)} km/h`;
}
