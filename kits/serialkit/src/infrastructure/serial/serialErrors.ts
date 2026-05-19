export type SerialUserErrorCode =
  | "not_supported"
  | "not_secure_context"
  | "permission_denied"
  | "port_in_use"
  | "open_failed"
  | "read_failed"
  | "write_failed"
  | "disconnected"
  | "unknown";

export type SerialUserError = {
  code: SerialUserErrorCode;
  message: string;
  cause?: unknown;
};

function isDomException(e: unknown): e is DOMException {
  return typeof DOMException !== "undefined" && e instanceof DOMException;
}

export function toSerialUserError(e: unknown, fallback: SerialUserError): SerialUserError {
  if (isDomException(e)) {
    const name = e.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      return { code: "permission_denied", message: "串口权限被拒绝。请重新选择端口并允许权限。", cause: e };
    }
    if (name === "NetworkError") {
      // Chromium: port already open / disconnected / etc.
      return { code: "open_failed", message: "串口打开失败（可能已被占用或已断开）。", cause: e };
    }
    return { code: "unknown", message: e.message || fallback.message, cause: e };
  }

  if (e instanceof Error) {
    return { code: fallback.code, message: e.message || fallback.message, cause: e };
  }

  return { ...fallback, cause: e };
}
