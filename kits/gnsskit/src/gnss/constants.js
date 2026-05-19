// @ts-check

export const BAUD_RATES = Object.freeze([
  4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600,
]);

export const DEFAULT_BAUD_RATE = 115200;

export const RAW_MAX_LINES = 1500;
export const RAW_LINE_MAX_LENGTH = 256;

// UI 刷新节流：raw 行批量追加频率
export const RAW_FLUSH_INTERVAL_MS = 120;

/** 解析面板：多系统 GNGSA 在短时间内连续到达，合并后再刷新，避免中间态 */
export const NMEA_SNAPSHOT_GSA_COALESCE_MS = 90;
