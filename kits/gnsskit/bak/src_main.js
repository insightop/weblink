// 导入工具函数
import {
  checkResourceLoading,
  initDownloadButton,
  formatTime,
  formatDistance,
  isValidJSON,
  logger,
} from "./utils.js";

import {
  initUIElements,
  updateButtonState,
  updateSystemLog,
  updateDataLog,
  toggleLogsDisplay,
  clearDisplay,
  setDataTable,
  setAutoGettingStatus,
  getAutoGettingStatus,
  setDeviceData,
  getDeviceData,
  addDiscoveredUid,
  getDiscoveredUids,
  setDeviceResponseStatus,
  getDeviceResponseStatus,
  clearDeviceResponseStatus,
  setSelectedUid,
  getSelectedUid,
  clearSelectedUid,
  clearSelectedRow,
  setSelectedRow,
  restoreSelectedRow,
  handleRowClick,
  handleDocumentClick,
  applyResponseStatusColors,
  updateTableDisplay,
} from "./ui.js";

// 波特率配置
const DEFAULT_BAUDRATE = 115200; // 通信模式波特率

let port = null;
let reader = null;
let writer = null;
let systemLog = null;
let dataLog = null;
let toggleButton = null;
let getButton = null;
let resetButton = null;
let rebootButton = null;
let setButton = null;
let toggleLogsButton = null;
let logsContainer = null;
let isPortOpen = false;
let dataStatusTimer = null; // 添加数据状态计时器

// 新增：自动读取定时器和状态
let autoGetDataTimer = null; // 自动读取定时器
let isAutoGetting = false; // 是否正在自动读取
let isScanningUids = false; // 是否正在扫描UID
let discoveredUids = []; // 发现的UID列表

// 新增：设备响应状态跟踪
let deviceResponseStatus = new Map(); // 存储每个设备的响应状态：'online'=在线, 'offline'=离线

// 新增：get data响应超时跟踪
let getDataTimeouts = new Map(); // 存储每个设备的get data超时定时器

// 新增：表格选中功能
let selectedUid = null; // 当前选中的UID

// 用于存储接收到的数据片段
let receivedData = "";
let buffer = ""; // 添加一个缓冲区
let downloadAbortController = null;

// 新增：存储多个设备的数据
let deviceDataMap = new Map(); // 存储每个设备的最新数据

// 添加UI更新防抖
let updateDebounceTimer = null;
let pendingDisplayData = null;

// DataTables表格实例
let dataTable = null;

// 使用导入的UI模块函数，移除重复定义

// 使用导入的工具函数，移除重复定义

// 实际执行UI更新的函数
function performDisplayUpdate(data) {
  if (!data || !data.uid) return;

  // 存储设备数据
  setDeviceData(data.uid, data);

  // get data成功，设置在线
  setDeviceResponseStatus(data.uid, "online");

  // 清除get data超时定时器
  if (getDataTimeouts.has(data.uid)) {
    clearTimeout(getDataTimeouts.get(data.uid));
    getDataTimeouts.delete(data.uid);
  }

  // 更新表格显示
  updateTableDisplay();

  // 更新数据日志
  updateDataLog(data);
}

// 使用导入的UI模块函数，移除重复定义

// 更新数据显示（带防抖）
function updateDisplay(data) {
  if (!data) return;

  // 保存最新的数据
  pendingDisplayData = data;

  // 取消之前的更新计时器
  if (updateDebounceTimer) {
    clearTimeout(updateDebounceTimer);
  }

  // 设置新的更新计时器，16ms防抖（约60fps）
  updateDebounceTimer = setTimeout(() => {
    performDisplayUpdate(pendingDisplayData);
    updateDebounceTimer = null;
    pendingDisplayData = null;
  }, 16);
}

// 使用导入的UI模块函数，移除重复定义

// 使用导入的UI模块函数，移除重复定义

// 使用导入的UI模块函数，移除重复定义

// 更新数据接收状态
function updateDataStatus(isOnline) {
  const dataStatusElement = document.getElementById("dataStatus");
  if (dataStatusElement) {
    dataStatusElement.textContent = isOnline ? "在线" : "离线";
    dataStatusElement.style.color = isOnline ? "#4CAF50" : "#F44336";
  }
}

// 重置数据状态计时器
function resetDataStatusTimer() {
  if (dataStatusTimer) {
    clearTimeout(dataStatusTimer);
  }
  updateDataStatus(true);
  dataStatusTimer = setTimeout(() => {
    updateDataStatus(false);
  }, 2000);
}

// 处理接收到的数据
function processReceivedData(text) {
  // 重置数据状态计时器
  resetDataStatusTimer();

  // 将新接收到的数据添加到缓冲区
  buffer += text;
  // console.log("[processReceivedData] 收到原始数据:", text);

  // 1. 先处理所有小json（{"uid":...}）用于扫描UID
  // 匹配格式：{  "uid": "5d5ff393935424757257635" } {  "uid": "5d5ff393935424757257631" }
  const uidRegex = /\{\s*"uid"\s*:\s*"[^"]*"\s*\}/g;
  let match;
  let uidFound = false;

  while ((match = uidRegex.exec(buffer)) !== null) {
    let jsonStr = match[0];
    try {
      const data = JSON.parse(jsonStr);
      if (typeof data.uid !== "undefined" && Object.keys(data).length === 1) {
        const uid = data.uid;
        // 修改：保持UID列表只增不减
        if (isScanningUids && !getDiscoveredUids().includes(uid)) {
          addDiscoveredUid(uid);
          // get uid成功，设置在线
          setDeviceResponseStatus(uid, "online");
          uidFound = true;
          console.log("[processReceivedData] 扫描发现新UID:", uid);
        }
      }
    } catch (e) {
      console.log("[processReceivedData] UID解析失败:", jsonStr, e);
    }
  }

  // 如果扫描期间发现了新的UID，记录日志
  if (isScanningUids && uidFound) {
    console.log("[processReceivedData] 当前UID列表:", getDiscoveredUids());
    // console.log("[processReceivedData] 剩余buffer长度:", buffer.length);
  }

  // buffer不截断，继续往下处理

  // 2. 处理大json（只在最外层大括号配对时才解析）
  let i = 0;
  let processedCount = 0;
  while (i < buffer.length) {
    // 找到第一个 {
    let start = buffer.indexOf("{", i);
    if (start === -1) break;
    let bracketCount = 0;
    let end = -1;
    for (let j = start; j < buffer.length; j++) {
      if (buffer[j] === "{") bracketCount++;
      if (buffer[j] === "}") bracketCount--;
      if (bracketCount === 0) {
        end = j;
        break;
      }
    }
    if (end !== -1) {
      const jsonStr = buffer.substring(start, end + 1);

      // 检查JSON是否包含必要的字段，避免解析不完整的JSON
      if (jsonStr.includes('"current"') || jsonStr.includes('"total"')) {
        try {
          const data = JSON.parse(jsonStr);
          // 只渲染包含current/total等完整结构的对象
          if (
            typeof data.current !== "undefined" ||
            typeof data.total !== "undefined"
          ) {
            console.log("[processReceivedData] 解析到完整大JSON:", data);
            updateDisplay(data);
            processedCount++;
          }
        } catch (e) {
          console.log(
            "[processReceivedData] 大JSON解析失败:",
            jsonStr.substring(0, 100),
            e
          );
        }
      }
      buffer = buffer.substring(end + 1);
      i = 0; // 重新从头查找
    } else {
      // 没有找到完整的JSON，等待下次补全
      break;
    }
  }

  // 如果缓冲区太大，清理旧数据
  if (buffer.length > 1000) {
    buffer = buffer.substring(buffer.length - 1000);
  }
}

// 平滑更新表格，移除下线的设备（简化版本）
function smoothUpdateTable() {
  if (!dataTable) return;

  // 直接使用updateTableDisplay来确保稳定性
  updateTableDisplay();
}

// 为新的UID添加表格行（保留原有函数以兼容）
function addDeviceRow(uid) {
  if (!dataTable) return;

  // 检查是否已经存在该UID的行
  const existingRows = dataTable.rows().data();
  for (let i = 0; i < existingRows.length; i++) {
    if (existingRows[i][0] === uid) {
      return; // 已存在，不重复添加
    }
  }

  // 为新UID创建空数据
  if (!deviceDataMap.has(uid)) {
    deviceDataMap.set(uid, { uid: uid });
  }

  // 重新绘制整个表格以保持一致性
  updateTableDisplay();
}

// 抽象发送串口命令的通用函数
async function sendSerialCommand(command, successMsg) {
  if (!isPortOpen || !writer) {
    updateSystemLog("错误：串口未连接");
    return;
  }
  try {
    const bytes = new Uint8Array([...command].map((c) => c.charCodeAt(0)));
    await writer.write(bytes);
    await writer.ready;
    updateSystemLog(successMsg);
  } catch (error) {
    updateSystemLog(`发送命令错误: ${error}`);
  }
}

async function openSerialPort() {
  try {
    updateSystemLog("正在请求打开串口...");
    console.log("开始请求串口权限...");

    // 检查是否支持 Web Serial API
    if (!navigator.serial) {
      console.error("Web Serial API 不可用");
      throw new Error("您的浏览器不支持 Web Serial API");
    }

    console.log("Web Serial API 可用，准备请求串口...");

    // 请求串口权限
    try {
      port = await navigator.serial.requestPort();
      if (!port) {
        throw new Error("未选择串口设备");
      }
      console.log("串口选择成功:", port);
    } catch (requestError) {
      console.error("串口请求失败:", requestError);
      if (requestError.name === "NotFoundError") {
        throw new Error("未找到可用的串口设备");
      } else if (requestError.name === "SecurityError") {
        throw new Error("没有串口访问权限");
      } else {
        throw requestError;
      }
    }

    updateSystemLog("串口已选择，正在打开...");
    console.log("准备打开串口...");

    // 尝试打开串口
    try {
      await port.open({ baudRate: DEFAULT_BAUDRATE });
      console.log("串口打开成功");
    } catch (openError) {
      console.error("打开串口失败:", openError);
      updateSystemLog(`打开串口失败: ${openError.message}`);
      throw openError;
    }

    writer = port.writable.getWriter();
    reader = port.readable.getReader();

    isPortOpen = true;
    updateButtonState(true);
    updateSystemLog("串口已成功打开");
    receivedData = ""; // 清空数据缓存

    // 开始读取数据
    startReading();
  } catch (error) {
    let errorMessage = "打开串口错误: ";
    console.error("串口操作错误:", error);

    if (error.name === "NotFoundError") {
      errorMessage += "未选择串口设备";
    } else if (error.name === "SecurityError") {
      errorMessage += "没有串口访问权限";
    } else if (error.name === "NetworkError") {
      errorMessage += "串口设备被占用或已断开";
    } else {
      errorMessage += error.message || "未知错误";
    }

    updateSystemLog(errorMessage);
    isPortOpen = false;
    updateButtonState(false);

    // 清理资源
    if (port) {
      try {
        await port.close();
      } catch (closeError) {
        console.error("关闭串口失败:", closeError);
      }
      port = null;
    }
  }
}

async function closeSerialPort() {
  if (reader) {
    await reader.cancel();
  }
  if (writer) {
    await writer.close();
  }
  if (port) {
    await port.close();
  }

  isPortOpen = false;
  updateButtonState(false);
  receivedData = ""; // 清空数据缓存
  buffer = ""; // 清空缓冲区

  // 清空发现的UID列表
  clearDeviceResponseStatus(); // 清空设备响应状态
  getDataTimeouts.clear(); // 清理超时定时器
  clearDisplay(); // 断开串口时清空界面
  stopAutoGetData(); // 断开串口时停止自动读取

  // 清除选中状态
  clearSelectedRow();

  // 清除所有计时器并更新状态
  if (dataStatusTimer) {
    clearTimeout(dataStatusTimer);
    dataStatusTimer = null;
  }
  if (updateDebounceTimer) {
    clearTimeout(updateDebounceTimer);
    updateDebounceTimer = null;
  }
  if (dataLogDebounceTimer) {
    clearTimeout(dataLogDebounceTimer);
    dataLogDebounceTimer = null;
  }

  updateDataStatus(false);
  updateSystemLog("串口已关闭");
}

// 开始读取数据
async function startReading() {
  while (port.readable) {
    try {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      const text = new TextDecoder().decode(value);
      processReceivedData(text);
    } catch (error) {
      updateSystemLog(`读取错误: ${error}`);
    }
  }
}

// 使用导入的UI模块函数，移除重复定义

// 初始化DataTables表格
function initDataTable() {
  const tableElement = document.getElementById("dataTable");
  if (!tableElement) return;

  // 检查jQuery和DataTables是否已加载
  if (typeof $ === "undefined" || typeof $.fn.DataTable === "undefined") {
    console.warn("jQuery或DataTables未加载，延迟初始化...");
    setTimeout(initDataTable, 100);
    return;
  }

  dataTable = $(tableElement).DataTable({
    paging: false, // 禁用分页
    searching: false, // 禁用搜索
    info: false, // 禁用信息显示
    ordering: false, // 禁用排序
    scrollX: true, // 启用DataTables的横向滚动
    // 不设置scrollY，让表格自适应高度
    language: {
      emptyTable: "暂无数据",
    },
    columnDefs: [
      { width: "250px", targets: 0, className: "text-center" }, // UID列
      { width: "120px", targets: 1, className: "text-center" }, // 开机时长
      { width: "120px", targets: 2, className: "text-center" }, // 运行时长
      { width: "120px", targets: 3, className: "text-center" }, // 行驶里程
      { width: "120px", targets: 4, className: "text-center" }, // 累计开机
      { width: "120px", targets: 5, className: "text-center" }, // 累计运行
      { width: "120px", targets: 6, className: "text-center" }, // 累计里程
      { width: "100px", targets: 7, className: "text-center" }, // 温度
      { width: "100px", targets: 8, className: "text-center" }, // 卫星数
      { width: "100px", targets: 9, className: "text-center" }, // 定位精度
    ],
    createdRow: function (row, data, dataIndex) {
      // 在行创建时设置样式
      const uid = data[0]; // 第一列是UID
      if (getDeviceResponseStatus(uid)) {
        const status = getDeviceResponseStatus(uid);
        if (status === "online") {
          $(row).addClass("has-response");
        } else if (status === "offline") {
          $(row).addClass("no-response");
        }
      }

      // 添加点击事件监听器
      $(row).on("click", handleRowClick);
      $(row).css("cursor", "pointer"); // 添加鼠标指针样式
    },
    drawCallback: function () {
      // 应用响应状态背景颜色
      applyResponseStatusColors();
      // 恢复选中状态
      restoreSelectedRow();
    },
  });

  // 设置DataTable实例到UI模块
  setDataTable(dataTable);
}

// 按钮点击事件处理
async function handleTogglePortClick() {
  if (isPortOpen) {
    updateSystemLog("正在关闭串口...");
    await closeSerialPort();
  } else {
    updateSystemLog("正在打开串口...");
    await openSerialPort();
  }
}
// 处理读取数据按钮点击
async function handlegetClick() {
  if (!getAutoGettingStatus()) {
    // 启动自动读取
    updateSystemLog("开始自动读取数据...");
    // 修改：不清空UID列表，保持只增不减
    // deviceDataMap.clear();
    // discoveredUids = [];
    // currentUidIndex = 0;

    // 清空表格显示
    if (dataTable) {
      dataTable.clear().draw();
    }
    if (dataLog) dataLog.textContent = "";
    const ts = document.getElementById("timestamp");
    if (ts) ts.textContent = "--";

    // 禁用其他操作按钮
    if (resetButton) {
      resetButton.disabled = true;
      resetButton.classList.add("disabled");
    }
    if (rebootButton) {
      rebootButton.disabled = true;
      rebootButton.classList.add("disabled");
    }
    if (setButton) {
      setButton.disabled = true;
      setButton.classList.add("disabled");
    }

    // 按钮变成"停止读取"，变为黄色
    if (getButton) {
      getButton.querySelector("span").textContent = "停止读取";
      getButton.querySelector("i").className = "bi bi-stop-circle";
      getButton.disabled = false;
      getButton.classList.remove("get-btn-green");
      getButton.classList.add("get-btn-yellow");
      getButton.classList.remove("disabled");
    }

    setAutoGettingStatus(true);
    updateActionButtonsState();

    // 开始自动读取循环
    startAutoReadCycle();
  } else {
    // 停止自动读取
    stopAutoGetData();
  }
}

// 开始自动读取循环
async function startAutoReadCycle() {
  if (!getAutoGettingStatus() || !isPortOpen) return;

  // 第一阶段：发送get uid广播，等待3秒收集UID
  updateSystemLog("发送get uid广播，等待设备响应...");
  isScanningUids = true; // 设置扫描标志
  // 修改：不清空UID列表，保持只增不减
  // discoveredUids = []; // 清空当前UID列表，准备重新扫描
  await sendSerialCommand("get uid\r\n", "已发送: get uid");

  // 等待3秒收集UID
  setTimeout(async () => {
    if (!getAutoGettingStatus() || !isPortOpen) return;

    isScanningUids = false; // 扫描结束

    // 清理buffer中的UID数据，避免重复处理
    buffer = buffer.replace(
      /\{\s*"uid"\s*:\s*("[^"]*"|[0-9a-zA-Z]+)\s*\}/g,
      ""
    );

    const discoveredUids = getDiscoveredUids();
    updateSystemLog(
      `发现 ${discoveredUids.length} 个设备: ${discoveredUids.join(", ")}`
    );

    if (discoveredUids.length === 0) {
      updateSystemLog("未发现任何设备，重新开始扫描...");
      startAutoReadCycle(); // 重新开始循环
      return;
    }

    // 扫描结束后，确保所有发现的UID都在表格中显示
    updateTableDisplay();

    // 第二阶段：遍历所有UID获取数据
    await queryAllDevices();
  }, 3000);
}

// 查询所有设备数据
async function queryAllDevices() {
  if (!getAutoGettingStatus() || !isPortOpen) return;

  const discoveredUids = getDiscoveredUids();
  for (let i = 0; i < discoveredUids.length; i++) {
    if (!getAutoGettingStatus() || !isPortOpen) return;

    const uid = discoveredUids[i];
    updateSystemLog(`查询设备 ${uid} 数据...`);

    // 清除之前的超时定时器
    if (getDataTimeouts.has(uid)) {
      clearTimeout(getDataTimeouts.get(uid));
    }

    // 设置get data超时定时器（3秒后如果没有响应就设置为离线）
    const timeoutId = setTimeout(() => {
      if (getAutoGettingStatus() && isPortOpen) {
        setDeviceResponseStatus(uid, "offline");
        console.log(`[queryAllDevices] 设备 ${uid} get data超时，设置为离线`);
        updateTableDisplay();
      }
    }, 3000);
    getDataTimeouts.set(uid, timeoutId);

    await sendSerialCommand(`get ${uid}\r\n`, `已发送: get ${uid}`);

    // 每个设备查询间隔2秒
    if (i < discoveredUids.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // 所有设备查询完成后，等待2秒开始下一轮循环
  setTimeout(() => {
    if (getAutoGettingStatus() && isPortOpen) {
      updateSystemLog("完成一轮数据查询，开始下一轮...");
      startAutoReadCycle();
    }
  }, 2000);
}

// 停止自动读取
function stopAutoGetData() {
  if (autoGetDataTimer) {
    clearInterval(autoGetDataTimer);
    autoGetDataTimer = null;
  }
  setAutoGettingStatus(false);

  // 清理所有超时定时器
  getDataTimeouts.forEach((timeoutId) => {
    clearTimeout(timeoutId);
  });
  getDataTimeouts.clear();

  // 恢复按钮
  if (getButton) {
    getButton.querySelector("span").textContent = "读取数据";
    getButton.querySelector("i").className = "bi bi-database";
    getButton.classList.remove("get-btn-yellow");
    getButton.classList.add("get-btn-green");
  }
  updateActionButtonsState();
  updateSystemLog("已停止自动读取数据");
}

// 处理清除数据按钮点击
async function handleResetClick() {
  if (!isPortOpen) {
    updateSystemLog("错误：请先连接串口");
    return;
  }
  const selectedUid = getSelectedUid();
  if (!selectedUid) {
    updateSystemLog("错误：请先选中一个设备");
    return;
  }
  const confirmed = window.confirm(`是否重置终端 ${selectedUid}？
成功后将自动重启，请稍等...
    `);
  if (confirmed) {
    await sendSerialCommand(
      `reset ${selectedUid}\r\n`,
      `已发送: reset ${selectedUid}`
    );
  }
}

// 处理重启按钮点击
async function handleRebootClick() {
  if (!isPortOpen) {
    updateSystemLog("错误：请先连接串口");
    return;
  }
  const selectedUid = getSelectedUid();
  if (!selectedUid) {
    updateSystemLog("错误：请先选中一个设备");
    return;
  }
  const confirmed = window.confirm(`是否重启终端 ${selectedUid}？`);
  if (confirmed) {
    await sendSerialCommand(
      `reboot ${selectedUid}\r\n`,
      `已发送: reboot ${selectedUid}`
    );
  }
}

// 处理下发数据按钮点击
async function handleSetClick() {
  if (!isPortOpen) {
    updateSystemLog("错误：请先连接串口");
    return;
  }
  const selectedUid = getSelectedUid();
  if (!selectedUid) {
    updateSystemLog("错误：请先选中一个设备");
    return;
  }
  // 弹出参数输入框
  const params = prompt(
    `目标设备: ${selectedUid}
请输入里程数据(单位:米)
成功后将自动重启，请稍等...`,
    "100.00"
  );
  if (params) {
    await sendSerialCommand(
      `set ${selectedUid} distance ${params}\r\n`,
      `已发送: set ${selectedUid} distance ${params}`
    );
  }
}

// 初始化函数
async function init() {
  // 只初始化主功能按钮，不再操作downloadBtn/ispBtn
  ["get", "reboot", "reset", "set"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = true;
  });

  // 只在不支持Web Serial API时用系统alert
  if (!("serial" in navigator)) {
    alert("当前浏览器暂不支持Web Serial API，请使用Chrome、Edge等");
    return;
  }

  // 使用UI模块初始化元素
  if (!initUIElements()) {
    logger.error("UI元素初始化失败");
    return;
  }

  // 获取UI元素引用
  systemLog = document.getElementById("systemLog");
  dataLog = document.getElementById("dataLog");
  toggleButton = document.getElementById("togglePort");
  getButton = document.getElementById("get");
  rebootButton = document.getElementById("reboot");
  resetButton = document.getElementById("reset");
  setButton = document.getElementById("set");
  toggleLogsButton = document.getElementById("toggleLogs");
  logsContainer = document.querySelector(".logs-container");

  toggleButton.addEventListener("click", handleTogglePortClick);
  getButton.addEventListener("click", handlegetClick);
  rebootButton.addEventListener("click", handleRebootClick);
  resetButton.addEventListener("click", handleResetClick);
  setButton.addEventListener("click", handleSetClick);
  toggleLogsButton.addEventListener("click", toggleLogsDisplay);
  updateButtonState(false);

  // 初始化DataTables表格
  initDataTable();

  // 添加点击空白处清空选择的监听器
  document.addEventListener("click", handleDocumentClick);
}

// 使用导入的工具函数，移除重复定义

// 确保所有脚本加载完成后再初始化
function ensureDataTablesLoaded() {
  if (typeof $ === "undefined" || typeof $.fn.DataTable === "undefined") {
    console.warn("jQuery或DataTables未加载，等待加载完成...");
    setTimeout(ensureDataTablesLoaded, 100);
    return;
  }
  console.log("jQuery和DataTables加载完成，开始初始化...");
  init();
}

// 等待页面加载完成后初始化
window.addEventListener("load", ensureDataTablesLoaded);

// DOM内容加载完成后初始化下载按钮和资源检查
window.addEventListener("DOMContentLoaded", function () {
  initDownloadButton();

  // 延迟检查资源加载状态
  setTimeout(checkResourceLoading, 2000);
});

// json数据格式：
// {
//   "current": {
//     "uptime": 100,
//     "runtime": 100,
//     "distance": 100,
//   },
//   "total": {
//     "uptime": 100,
//     "runtime": 100,
//     "distance": 100
//   },
//   "temp": 100,
// }
