/**
 * 统一本地持久化（localStorage）
 *
 * 约定：
 * - 右栏宽度、主页「原始/日志」分割高度：存像素，与 CSS 变量 --sidebar-width、--raw-panel-height 一致；
 *   窗口尺寸变化时由现有 resizer 逻辑再 clamp，不存占比比例。
 * - 右栏折叠：存布尔。
 * - 诊断勾选：存 JSON 对象（与各 DEBUG_TYPES 键对齐）。
 */

/** @type {Record<string, string>} */
const LEGACY_KEYS = {
  mainSidebarWidthPx: "iot_odom:rightPanelWidthPx",
  mainRawPanelHeightPx: "iot_odom:rawPanelHeightPx",
  gnssSidebarWidthPx: "iot_odom:gnssRightPanelWidthPx",
};

export const AppStorageKeys = {
  mainDebugGlobal: "iot_odom:v2:main.debug.globalSelected",
  mainRightCollapsed: "iot_odom:v2:main.rightPanel.collapsed",
  mainSidebarWidthPx: "iot_odom:v2:main.sidebarWidthPx",
  mainRawPanelHeightPx: "iot_odom:v2:main.rawPanelHeightPx",
  gnssBaudRate: "iot_odom:v2:gnss.baudRate",
  gnssRightCollapsed: "iot_odom:v2:gnss.rightPanel.collapsed",
  gnssSidebarWidthPx: "iot_odom:v2:gnss.sidebarWidthPx",
};

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn("[appStorage] write failed", key, e);
  }
}

/**
 * @param {string} key
 * @param {string | null} [legacyKey]
 * @returns {number | null}
 */
function readNumberWithLegacy(key, legacyKey) {
  let raw = safeGet(key);
  if (raw == null && legacyKey) raw = safeGet(legacyKey);
  if (raw == null) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * 首次从 legacy 读到值时写入新 key，便于逐步迁移
 * @param {string} key
 * @param {string | null} legacyKey
 * @param {number} n
 */
function migrateNumberIfNeeded(key, legacyKey, n) {
  if (legacyKey && safeGet(key) == null && safeGet(legacyKey) != null) {
    safeSet(key, String(n));
  }
}

/**
 * @returns {number | null}
 */
export function loadMainSidebarWidthPx() {
  const n = readNumberWithLegacy(
    AppStorageKeys.mainSidebarWidthPx,
    LEGACY_KEYS.mainSidebarWidthPx,
  );
  if (n != null) {
    migrateNumberIfNeeded(
      AppStorageKeys.mainSidebarWidthPx,
      LEGACY_KEYS.mainSidebarWidthPx,
      n,
    );
  }
  return n;
}

export function saveMainSidebarWidthPx(px) {
  safeSet(AppStorageKeys.mainSidebarWidthPx, String(px));
}

/**
 * @returns {number | null}
 */
export function loadMainRawPanelHeightPx() {
  const n = readNumberWithLegacy(
    AppStorageKeys.mainRawPanelHeightPx,
    LEGACY_KEYS.mainRawPanelHeightPx,
  );
  if (n != null) {
    migrateNumberIfNeeded(
      AppStorageKeys.mainRawPanelHeightPx,
      LEGACY_KEYS.mainRawPanelHeightPx,
      n,
    );
  }
  return n;
}

export function saveMainRawPanelHeightPx(px) {
  safeSet(AppStorageKeys.mainRawPanelHeightPx, String(px));
}

/**
 * @returns {boolean}
 */
export function loadMainRightPanelCollapsed() {
  const v = safeGet(AppStorageKeys.mainRightCollapsed);
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return false;
}

export function saveMainRightPanelCollapsed(collapsed) {
  safeSet(AppStorageKeys.mainRightCollapsed, collapsed ? "1" : "0");
}

/**
 * @template T
 * @param {string} key
 * @param {T} defaultVal
 * @returns {T}
 */
export function loadJson(key, defaultVal) {
  const raw = safeGet(key);
  if (!raw) return defaultVal;
  try {
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
}

export function saveJson(key, obj) {
  safeSet(key, JSON.stringify(obj));
}

/**
 * @returns {number | null}
 */
export function loadGnssSidebarWidthPx() {
  const n = readNumberWithLegacy(
    AppStorageKeys.gnssSidebarWidthPx,
    LEGACY_KEYS.gnssSidebarWidthPx,
  );
  if (n != null) {
    migrateNumberIfNeeded(
      AppStorageKeys.gnssSidebarWidthPx,
      LEGACY_KEYS.gnssSidebarWidthPx,
      n,
    );
  }
  return n;
}

export function saveGnssSidebarWidthPx(px) {
  safeSet(AppStorageKeys.gnssSidebarWidthPx, String(px));
}

export function loadGnssRightPanelCollapsed() {
  const v = safeGet(AppStorageKeys.gnssRightCollapsed);
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return false;
}

export function saveGnssRightPanelCollapsed(collapsed) {
  safeSet(AppStorageKeys.gnssRightCollapsed, collapsed ? "1" : "0");
}

/**
 * @returns {number | null}
 */
export function loadGnssBaudRate() {
  const raw = safeGet(AppStorageKeys.gnssBaudRate);
  if (raw == null) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function saveGnssBaudRate(rate) {
  safeSet(AppStorageKeys.gnssBaudRate, String(rate));
}
