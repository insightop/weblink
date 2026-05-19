export type WebApiErrorCode =
  | "not_supported"
  | "not_secure_context"
  | "permission_denied"
  | "port_in_use"
  | "open_failed"
  | "read_failed"
  | "write_failed"
  | "disconnected"
  | "user_cancelled"
  | "claim_failed"
  | "transfer_failed"
  | "unknown";

export class WebApiError extends Error {
  readonly code: WebApiErrorCode;
  override readonly cause?: unknown;

  constructor(code: WebApiErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "WebApiError";
    this.code = code;
    this.cause = options?.cause;
  }
}

function isDomException(e: unknown): e is DOMException {
  return typeof DOMException !== "undefined" && e instanceof DOMException;
}

export function toWebApiError(
  e: unknown,
  fallback: { code: WebApiErrorCode; message: string },
): WebApiError {
  if (e instanceof WebApiError) return e;

  if (isDomException(e)) {
    const name = e.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      return new WebApiError("permission_denied", "Permission denied. Please re-select and allow access.", { cause: e });
    }
    if (name === "NotFoundError") {
      return new WebApiError("user_cancelled", "No device selected.", { cause: e });
    }
    if (name === "NetworkError") {
      return new WebApiError("open_failed", "Connection failed (device may be in use or disconnected).", { cause: e });
    }
    return new WebApiError("unknown", e.message || fallback.message, { cause: e });
  }

  if (e instanceof Error) {
    return new WebApiError(fallback.code, e.message || fallback.message, { cause: e });
  }

  return new WebApiError(fallback.code, fallback.message, { cause: e });
}
