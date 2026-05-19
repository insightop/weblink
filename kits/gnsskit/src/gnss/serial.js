// @ts-check

/**
 * @typedef {Object} OpenOk
 * @property {true} ok
 *
 * @typedef {Object} OpenErr
 * @property {false} ok
 * @property {string} errorMessage
 *
 * @typedef {OpenOk | OpenErr} OpenResult
 */

export function createGnssSerial() {
  /** @type {SerialPort | null} */
  let port = null;
  /** @type {ReadableStreamDefaultReader<Uint8Array> | null} */
  let reader = null;
  let reading = false;

  /**
   * @param {{ baudRate: number }} options
   * @returns {Promise<OpenResult>}
   */
  async function open(options) {
    try {
      if (!("serial" in navigator)) {
        return { ok: false, errorMessage: "当前浏览器不支持 Web Serial API" };
      }
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: options.baudRate });
      reader = port.readable?.getReader() || null;
      if (!reader) {
        return { ok: false, errorMessage: "串口不可读（readable 不可用）" };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, errorMessage: mapSerialError(err) };
    }
  }

  /**
   * @param {(textChunk: string) => void} onChunkText
   */
  function startReadLoop(onChunkText) {
    if (!reader || reading) return;
    reading = true;
    const decoder = new TextDecoder();

    (async () => {
      while (reading) {
        try {
          const { value, done } = await reader.read();
          if (done) break;
          if (value && value.length > 0) {
            const text = decoder.decode(value);
            try {
              onChunkText(text);
            } catch (err) {
              console.error("[GNSS] onChunkText 处理异常，已忽略以保持读循环", err);
            }
          }
        } catch {
          // 读循环异常时直接退出，让上层提示重连
          break;
        }
      }
      reading = false;
    })();
  }

  async function close() {
    reading = false;
    try {
      if (reader) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        reader.releaseLock();
      }
    } finally {
      reader = null;
    }

    if (port) {
      try {
        await port.close();
      } catch {
        // ignore
      } finally {
        port = null;
      }
    }
  }

  return { open, startReadLoop, close };
}

/**
 * @param {any} err
 */
function mapSerialError(err) {
  const name = err?.name;
  if (name === "NotFoundError") return "未选择串口设备";
  if (name === "SecurityError") return "没有串口访问权限";
  if (name === "InvalidStateError") return "串口状态异常（可能已打开或不可用）";
  if (name === "NetworkError") return "串口设备被占用或已断开";
  const msg = err?.message ? String(err.message) : String(err);
  return `打开/读取串口失败：${msg}`;
}
