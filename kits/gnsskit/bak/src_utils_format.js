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
  if (
    meters === "nan" ||
    meters === "-nan" ||
    meters === "NaN" ||
    meters === "-NaN"
  ) {
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
