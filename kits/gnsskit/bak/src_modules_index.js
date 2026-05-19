/**
 * 模块统一导出
 */

// 状态管理
export {
  AppState,
  DeviceStatus,
  getDevice,
  setDeviceData,
  setDeviceStatus,
  addDiscoveredUid,
  clearDevices,
  getAllDevicesForTable,
  resetSerialState,
  resetUiState,
  clearAllTimers,
  setGetDataTimeout,
  clearGetDataTimeout,
} from "./state.js";

// 串口通信
export {
  openSerialPort,
  closeSerialPort,
  sendCommand,
  isLocalDevelopment,
} from "./serial.js";

// 表格渲染
export {
  initDataTable,
  updateTableDisplay,
  setSelectedRow,
  clearSelectedRow,
  clearTable,
  getDataTable,
} from "./table.js";

// UI 更新
export {
  initUIElements,
  getElements,
  updateConnectionButton,
  updateGetButton,
  updateActionButtons,
  addLogEntry,
  toggleLogPanel,
  clearAllLogs,
  filterLogs,
  filterLogsByType,
  getSelectedFilterTypes,
  toggleFilterDropdown,
  exportLogs,
  disableAllButtons,
  showToast,
  // 向后兼容
  addSystemLog,
  updateDataLog,
  clearLogs,
} from "./ui.js";
