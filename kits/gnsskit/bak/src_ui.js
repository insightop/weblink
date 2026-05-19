/**
 * UI管理模块
 * 包含所有UI相关的函数和状态管理
 */

import { logger } from "./utils.js";

// UI元素引用
let systemLog = null;
let dataLog = null;
let toggleButton = null;
let getButton = null;
let resetButton = null;
let rebootButton = null;
let setButton = null;
let toggleLogsButton = null;
let logsContainer = null;
let dataTable = null;

// UI状态
let isPortOpen = false;
let isAutoGetting = false;
let selectedUid = null;

// 设备数据存储
let deviceDataMap = new Map();
let discoveredUids = [];
let deviceResponseStatus = new Map();

// 更新防抖
let updateDebounceTimer = null;
let pendingDisplayData = null;

// 初始化UI元素引用
export function initUIElements() {
  systemLog = document.getElementById("systemLog");
  dataLog = document.getElementById("dataLog");
  toggleButton = document.getElementById("togglePort");
  getButton = document.getElementById("get");
  rebootButton = document.getElementById("reboot");
  resetButton = document.getElementById("reset");
  setButton = document.getElementById("set");
  toggleLogsButton = document.getElementById("toggleLogs");
  logsContainer = document.querySelector(".logs-container");

  if (
    !systemLog ||
    !dataLog ||
    !toggleButton ||
    !getButton ||
    !rebootButton ||
    !resetButton ||
    !setButton ||
    !toggleLogsButton ||
    !logsContainer
  ) {
    logger.error("无法找到必要的DOM元素");
    return false;
  }

  return true;
}

// 更新按钮状态
export function updateButtonState(connected) {
  isPortOpen = connected;

  if (toggleButton) {
    toggleButton.disabled = false;
    toggleButton.classList.toggle("btn-connected", connected);
    toggleButton.querySelector("i").className = connected
      ? "bi bi-x-circle"
      : "bi bi-link-45deg";
    toggleButton.querySelector("span").textContent = connected
      ? "断开DTU"
      : "连接DTU";
  }

  // 更新读取数据按钮状态
  if (getButton) {
    getButton.disabled = !connected;
    getButton.classList.toggle("disabled", !connected);
    // get按钮初始为绿色
    getButton.classList.remove("get-btn-yellow");
    getButton.classList.add("get-btn-green");
  }

  updateActionButtonsState();
}

// 根据串口状态更新操作按钮
export function updateActionButtonsState() {
  // 只有串口连接且不在自动读取时才可用
  const enable = isPortOpen && !isAutoGetting;

  if (getButton) {
    getButton.disabled = !enable && !isAutoGetting; // 自动读取时只允许停止按钮可用
    getButton.classList.toggle("disabled", getButton.disabled);
    // 禁用时移除色彩类，启用时根据状态添加色彩类
    if (getButton.disabled) {
      getButton.classList.remove("get-btn-green", "get-btn-yellow");
    } else {
      if (!isAutoGetting) {
        getButton.classList.remove("get-btn-yellow");
        getButton.classList.add("get-btn-green");
      } else {
        getButton.classList.remove("get-btn-green");
        getButton.classList.add("get-btn-yellow");
      }
    }
  }

  // 重启、重置、下发按钮需要串口连接、不在自动读取、且有选中设备
  const actionButtonsEnabled =
    enable && selectedUid && discoveredUids.length > 0;

  if (resetButton) {
    resetButton.disabled = !actionButtonsEnabled;
    resetButton.classList.toggle("disabled", !actionButtonsEnabled);
  }
  if (rebootButton) {
    rebootButton.disabled = !actionButtonsEnabled;
    rebootButton.classList.toggle("disabled", !actionButtonsEnabled);
  }
  if (setButton) {
    setButton.disabled = !actionButtonsEnabled;
    setButton.classList.toggle("disabled", !actionButtonsEnabled);
  }
}

// 更新系统日志
export function updateSystemLog(message) {
  if (systemLog) {
    const timestamp = new Date().toLocaleTimeString();
    systemLog.textContent += `[${timestamp}] ${message}\n`;
    systemLog.scrollTop = systemLog.scrollHeight;

    // 强制UI立即更新
    requestAnimationFrame(() => {
      // 确保日志滚动位置正确
      systemLog.scrollTop = systemLog.scrollHeight;
    });
  }
}

// 数据日志更新防抖
let dataLogDebounceTimer = null;

// 更新数据日志
export function updateDataLog(data) {
  if (!dataLog) return;

  // 上传日志到 Cloudflare
  fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).catch((err) => {
    // 失败不影响本地显示
    logger.warn("日志上传失败", err);
  });

  // 取消之前的更新计时器
  if (dataLogDebounceTimer) {
    clearTimeout(dataLogDebounceTimer);
  }

  // 设置新的更新计时器，100ms防抖（数据日志更新频率适中）
  dataLogDebounceTimer = setTimeout(() => {
    const timestamp = new Date().toLocaleString();
    const timestampElement = document.getElementById("timestamp");
    if (timestampElement) {
      timestampElement.textContent = timestamp;
    }
    dataLog.textContent = JSON.stringify(data, null, 2);
    dataLogDebounceTimer = null;
  }, 100);
}

// 切换日志显示
export function toggleLogsDisplay() {
  const isVisible = logsContainer.style.display !== "none";
  logsContainer.style.display = isVisible ? "none" : "block";
  toggleLogsButton.querySelector("i").className = isVisible
    ? "bi bi-chevron-down"
    : "bi bi-chevron-up";
  toggleLogsButton.querySelector("span").textContent = isVisible
    ? "显示日志"
    : "隐藏日志";
}

// 清空所有数据显示区
export function clearDisplay() {
  // 清除设备数据存储，但保留UID结构
  deviceDataMap.clear();

  // 为所有已发现的UID重新创建空数据
  discoveredUids.forEach((uid) => {
    deviceDataMap.set(uid, { uid: uid });
  });

  // 重新绘制表格，保持所有UID行
  if (dataTable) {
    updateTableDisplay();
  }

  // 清除日志
  if (dataLog) {
    dataLog.textContent = "";
  }
  if (systemLog) {
    systemLog.textContent = "";
  }

  // 清除选中状态
  clearSelectedRow();
}

// 设置DataTable实例
export function setDataTable(table) {
  dataTable = table;
}

// 获取DataTable实例
export function getDataTable() {
  return dataTable;
}

// 设置自动读取状态
export function setAutoGettingStatus(status) {
  isAutoGetting = status;
  updateActionButtonsState();
}

// 获取自动读取状态
export function getAutoGettingStatus() {
  return isAutoGetting;
}

// 设置设备数据
export function setDeviceData(uid, data) {
  deviceDataMap.set(uid, data);
}

// 获取设备数据
export function getDeviceData(uid) {
  return deviceDataMap.get(uid);
}

// 添加发现的UID
export function addDiscoveredUid(uid) {
  if (!discoveredUids.includes(uid)) {
    discoveredUids.push(uid);
  }
}

// 获取所有发现的UID
export function getDiscoveredUids() {
  return discoveredUids;
}

// 设置设备响应状态
export function setDeviceResponseStatus(uid, status) {
  deviceResponseStatus.set(uid, status);
}

// 获取设备响应状态
export function getDeviceResponseStatus(uid) {
  return deviceResponseStatus.get(uid);
}

// 清除设备响应状态
export function clearDeviceResponseStatus() {
  deviceResponseStatus.clear();
}

// 设置选中UID
export function setSelectedUid(uid) {
  selectedUid = uid;
  updateActionButtonsState();
}

// 获取选中UID
export function getSelectedUid() {
  return selectedUid;
}

// 清除选中UID
export function clearSelectedUid() {
  selectedUid = null;
  updateActionButtonsState();
}

// 清除选中行
export function clearSelectedRow() {
  if (dataTable) {
    dataTable.rows().every(function () {
      const rowNode = this.node();
      $(rowNode).removeClass("selected-row");
    });
  }
  clearSelectedUid();
}

// 设置选中行
export function setSelectedRow(uid) {
  // 清除之前的选中状态
  clearSelectedRow();

  // 设置新的选中UID
  selectedUid = uid;

  // 找到对应的行并添加选中样式
  if (dataTable) {
    dataTable.rows().every(function () {
      const rowNode = this.node();
      const rowUid = $(rowNode).find("td:first").text();
      if (rowUid === uid) {
        $(rowNode).addClass("selected-row");
        return false; // 找到后停止遍历
      }
    });
  }

  // 更新按钮状态
  updateActionButtonsState();

  logger.info(`选中设备: ${uid}`);
}

// 恢复选中状态
export function restoreSelectedRow() {
  if (selectedUid && dataTable) {
    dataTable.rows().every(function () {
      const rowNode = this.node();
      const rowUid = $(rowNode).find("td:first").text();
      if (rowUid === selectedUid) {
        $(rowNode).addClass("selected-row");
        return false; // 找到后停止遍历
      }
    });
  }
}

// 处理表格行点击事件
export function handleRowClick(event) {
  const row = $(event.currentTarget);
  const uid = row.find("td:first").text();

  // 阻止事件冒泡，避免触发document的点击事件
  event.stopPropagation();

  // 设置选中状态
  setSelectedRow(uid);
}

// 处理点击空白处清空选择
export function handleDocumentClick(event) {
  // 检查点击的元素是否在表格内
  const tableWrapper = $(".dataTables_wrapper");
  const isClickInTable =
    tableWrapper.length && tableWrapper[0].contains(event.target);

  // 检查点击的元素是否是按钮
  const isClickOnButton = $(event.target).closest("button").length > 0;

  // 如果点击在表格外且不是按钮，清空选择
  if (!isClickInTable && !isClickOnButton && selectedUid) {
    clearSelectedRow();
    updateActionButtonsState();
  }
}

// 应用响应状态背景颜色
export function applyResponseStatusColors() {
  if (!dataTable) return;

  dataTable.rows().every(function () {
    const rowNode = this.node(); // 获取实际的DOM节点
    const uid = $(rowNode).find("td:first").text(); // 获取UID

    // 先移除所有响应状态类和内联样式
    $(rowNode).removeClass("has-response no-response");
    $(rowNode).css("background-color", "");
    $(rowNode).css("border-left", "");

    if (deviceResponseStatus.has(uid)) {
      const status = deviceResponseStatus.get(uid);
      if (status === "online") {
        $(rowNode).addClass("has-response");
        logger.info(`设备 ${uid} 设置为在线状态`);
      } else if (status === "offline") {
        $(rowNode).addClass("no-response");
        logger.info(`设备 ${uid} 设置为离线状态`);
      }
    }
  });
}

// 更新表格显示
export function updateTableDisplay() {
  if (!dataTable) return;

  // 确保所有已发现的UID都在表格中
  discoveredUids.forEach((uid) => {
    if (!deviceDataMap.has(uid)) {
      // 如果某个UID还没有数据，为其创建空数据
      deviceDataMap.set(uid, { uid: uid });
    }
  });

  // 将设备数据转换为DataTables格式（只包含当前在线的设备）
  const tableData = [];
  discoveredUids.forEach((uid) => {
    const data = deviceDataMap.get(uid);
    if (data) {
      const uptime = data.current ? formatTime(data.current.uptime) : "--";
      const runtime = data.current ? formatTime(data.current.runtime) : "--";
      const distance = data.current
        ? formatDistance(data.current.distance)
        : "--";
      const uptimeTotal = data.total ? formatTime(data.total.uptime) : "--";
      const runtimeTotal = data.total ? formatTime(data.total.runtime) : "--";
      const distanceTotal = data.total
        ? formatDistance(data.total.distance)
        : "--";
      const temperature =
        typeof data.temp !== "undefined" ? `${data.temp}℃` : "--";
      const satellite =
        data.gnss && typeof data.gnss.satellite !== "undefined"
          ? data.gnss.satellite
          : "--";
      const precision =
        data.gnss && typeof data.gnss.precision !== "undefined"
          ? data.gnss.precision
          : "--";

      tableData.push([
        uid,
        uptime,
        runtime,
        distance,
        uptimeTotal,
        runtimeTotal,
        distanceTotal,
        temperature,
        satellite,
        precision,
      ]);
    }
  });

  // 更新表格数据
  dataTable.clear(); // 清除现有数据
  dataTable.rows.add(tableData); // 添加新数据
  dataTable.draw(); // 重新绘制表格

  // 应用响应状态背景颜色
  applyResponseStatusColors();

  // 恢复选中状态
  restoreSelectedRow();
}

// 格式化时间（秒转换为时分秒）
function formatTime(seconds) {
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

// 格式化距离（米转换为公里）
function formatDistance(meters) {
  // 如果是字符串 "nan" 或 "-nan"，直接返回
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
    // 处理数字型 NaN
    return "nan";
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}公里`;
  }
  return `${num}米`;
}
