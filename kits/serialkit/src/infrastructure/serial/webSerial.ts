import { isSecureContext, isWebApiSupported } from "@weblink/utils/web-api";
import { toSerialUserError, type SerialUserError } from "@/infrastructure/serial/serialErrors";

export function isSecureContextForSerial(): boolean {
  return isSecureContext();
}

export function isWebSerialSupported(): boolean {
  return isWebApiSupported("serial");
}

export async function requestSerialPort(): Promise<SerialPort> {
  if (!isWebSerialSupported()) {
    const err: SerialUserError = {
      code: "not_supported",
      message: "当前浏览器不支持 WebSerial。请使用 Chrome/Edge（HTTPS 或 localhost）。",
    };
    throw err;
  }
  if (!isSecureContextForSerial()) {
    const err: SerialUserError = {
      code: "not_secure_context",
      message: "需要 HTTPS 或 localhost（安全上下文）才能使用 WebSerial。",
    };
    throw err;
  }

  try {
    return await navigator.serial!.requestPort();
  } catch (e) {
    const fallback: SerialUserError = {
      code: "permission_denied",
      message: "选择串口失败。",
    };
    throw toSerialUserError(e, fallback);
  }
}

export async function getGrantedSerialPorts(): Promise<SerialPort[]> {
  if (!isWebSerialSupported()) return [];
  try {
    return await navigator.serial!.getPorts();
  } catch {
    return [];
  }
}
