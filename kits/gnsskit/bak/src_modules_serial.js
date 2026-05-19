/**
 * 串口通信模块
 */

import {
  AppState,
  resetSerialState,
  clearAllTimers,
  clearDevices,
} from "./state.js";

// 默认波特率
const DEFAULT_BAUDRATE = 115200;

/**
 * 打开串口
 * @param {Function} onData - 数据接收回调
 * @param {Function} onLog - 日志回调
 * @returns {Promise<boolean>} 是否成功
 */
export async function openSerialPort(onData, onLog) {
  try {
    onLog("正在请求打开串口...");

    // 检查是否支持 Web Serial API
    if (!navigator.serial) {
      throw new Error("您的浏览器不支持 Web Serial API");
    }

    // 请求串口权限
    try {
      AppState.serial.port = await navigator.serial.requestPort();
      if (!AppState.serial.port) {
        throw new Error("未选择串口设备");
      }
    } catch (requestError) {
      if (requestError.name === "NotFoundError") {
        throw new Error("未找到可用的串口设备");
      } else if (requestError.name === "SecurityError") {
        throw new Error("没有串口访问权限");
      }
      throw requestError;
    }

    onLog("串口已选择，正在打开...");

    // 打开串口
    await AppState.serial.port.open({ baudRate: DEFAULT_BAUDRATE });

    AppState.serial.writer = AppState.serial.port.writable.getWriter();
    AppState.serial.reader = AppState.serial.port.readable.getReader();
    AppState.serial.isOpen = true;

    onLog("串口已成功打开");

    // 开始读取数据
    startReading(onData, onLog);

    return true;
  } catch (error) {
    let errorMessage = "打开串口错误: ";

    if (error.name === "NotFoundError") {
      errorMessage += "未选择串口设备";
    } else if (error.name === "SecurityError") {
      errorMessage += "没有串口访问权限";
    } else if (error.name === "NetworkError") {
      errorMessage += "串口设备被占用或已断开";
    } else {
      errorMessage += error.message || "未知错误";
    }

    onLog(errorMessage);
    AppState.serial.isOpen = false;

    // 清理资源
    if (AppState.serial.port) {
      try {
        await AppState.serial.port.close();
      } catch (closeError) {
        console.error("关闭串口失败:", closeError);
      }
      resetSerialState();
    }

    return false;
  }
}

/**
 * 关闭串口
 * @param {Function} onLog - 日志回调
 */
export async function closeSerialPort(onLog) {
  try {
    if (AppState.serial.reader) {
      await AppState.serial.reader.cancel();
    }
    if (AppState.serial.writer) {
      await AppState.serial.writer.close();
    }
    if (AppState.serial.port) {
      await AppState.serial.port.close();
    }
  } catch (error) {
    console.error("关闭串口时出错:", error);
  }

  resetSerialState();
  AppState.buffer = "";
  clearAllTimers();
  clearDevices();
  AppState.ui.selectedUid = null;
  AppState.ui.isAutoGetting = false;
  AppState.ui.isScanningUids = false;

  onLog("串口已关闭");
}

/**
 * 开始读取串口数据
 * @param {Function} onData - 数据接收回调
 * @param {Function} onLog - 日志回调
 */
async function startReading(onData, onLog) {
  while (AppState.serial.port?.readable) {
    try {
      const { value, done } = await AppState.serial.reader.read();
      if (done) break;

      const text = new TextDecoder().decode(value);
      onData(text);
    } catch (error) {
      if (error.name !== "NetworkError") {
        onLog(`读取错误: ${error}`);
      }
      break;
    }
  }
}

/**
 * 发送串口命令
 * @param {string} command - 命令字符串
 * @param {Function} onLog - 日志回调
 * @returns {Promise<boolean>} 是否成功
 */
export async function sendCommand(command, onLog) {
  if (!AppState.serial.isOpen || !AppState.serial.writer) {
    onLog("错误：串口未连接");
    return false;
  }

  try {
    const bytes = new Uint8Array([...command].map((c) => c.charCodeAt(0)));
    await AppState.serial.writer.write(bytes);
    await AppState.serial.writer.ready;
    return true;
  } catch (error) {
    onLog(`发送命令错误: ${error}`);
    return false;
  }
}

/**
 * 检查是否是本地开发环境
 * @returns {boolean}
 */
export function isLocalDevelopment() {
  const hostname = window.location.hostname;
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === ""
  );
}
