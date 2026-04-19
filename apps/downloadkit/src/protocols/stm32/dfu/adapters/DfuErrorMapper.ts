import { ErrorCode, type DownloadError } from "@/core/errors/ErrorCode";
import { i18n } from "@/i18n";

function t(key: string): string {
  return String(i18n.global.t(key));
}

export function toDownloadError(
  code: ErrorCode,
  userMessage: string,
  cause: unknown,
): DownloadError {
  return {
    code,
    userMessage,
    debugMessage: cause instanceof Error ? cause.message : String(cause),
    cause,
  };
}

export function mapDfuProbeError(cause: unknown): DownloadError {
  return toDownloadError(ErrorCode.ProbeFailed, t("dfu.probeFailed"), cause);
}

export function mapDfuSyncError(cause: unknown): DownloadError {
  return toDownloadError(ErrorCode.SyncFailed, t("dfu.syncFailed"), cause);
}

export function mapDfuEraseError(cause: unknown): DownloadError {
  return toDownloadError(ErrorCode.EraseFailed, t("dfu.eraseFailed"), cause);
}

export function mapDfuWriteError(cause: unknown): DownloadError {
  return toDownloadError(ErrorCode.FlashFailed, t("dfu.flashFailed"), cause);
}

export function mapDfuResetError(cause: unknown): DownloadError {
  return toDownloadError(ErrorCode.ResetFailed, t("dfu.resetFailed"), cause);
}
