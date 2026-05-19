export type UserErrorCode =
  | "unsupported"
  | "insecure_context"
  | "permission_denied"
  | "permission_policy"
  | "not_found"
  | "invalid_state"
  | "network"
  | "unknown";

export class UserError extends Error {
  code: UserErrorCode;
  detail?: unknown;

  constructor(code: UserErrorCode, message: string, detail?: unknown) {
    super(message);
    this.name = "UserError";
    this.code = code;
    this.detail = detail;
  }
}

function isDomException(e: unknown): e is DOMException {
  return typeof e === "object" && e !== null && (e as DOMException).name != null;
}

export function toUserError(e: unknown): UserError {
  if (e instanceof UserError) return e;
  if (isDomException(e)) {
    const name = e.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      return new UserError("permission_denied", "操作被拒绝：请检查权限授权与安全上下文（HTTPS）", e);
    }
    if (name === "NotFoundError") {
      return new UserError("not_found", "未找到设备/目标资源", e);
    }
    if (name === "InvalidStateError") {
      return new UserError("invalid_state", "当前状态不允许该操作（可能未连接或已断开）", e);
    }
    if (name === "NetworkError") {
      return new UserError("network", "连接失败或已断开（NetworkError）", e);
    }
  }

  const msg = e instanceof Error ? e.message : String(e);
  if (/Permissions policy/i.test(msg) || /is not allowed in this document/i.test(msg)) {
    return new UserError("permission_policy", "被权限策略禁止：可能是 iframe 未放行相关能力", e);
  }
  return new UserError("unknown", msg || "未知错误", e);
}

