export enum ErrorCode {
  UnsupportedBrowser = "UNSUPPORTED_BROWSER",
  DeviceNotFound = "DEVICE_NOT_FOUND",
  ConnectionFailed = "CONNECTION_FAILED",
  ProbeFailed = "PROBE_FAILED",
  SyncFailed = "SYNC_FAILED",
  FlashPlanInvalid = "FLASH_PLAN_INVALID",
  EraseFailed = "ERASE_FAILED",
  FlashFailed = "FLASH_FAILED",
  VerifyFailed = "VERIFY_FAILED",
  ResetFailed = "RESET_FAILED",
  UserCancelled = "USER_CANCELLED",
  Unknown = "UNKNOWN",
}

export interface DownloadError {
  code: ErrorCode;
  userMessage: string;
  debugMessage?: string;
  cause?: unknown;
}

export function isDownloadError(value: unknown): value is DownloadError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "userMessage" in value &&
    typeof (value as DownloadError).userMessage === "string"
  );
}

export function isUserCancelledError(value: unknown): boolean {
  return isDownloadError(value) && value.code === ErrorCode.UserCancelled;
}
