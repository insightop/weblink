import { ErrorCode, type DownloadError } from "../errors/ErrorCode";
import { transitionStage } from "../stateMachine/downloadMachine";
import type { DownloadStage, StageProgress } from "../types/download";
import { i18n } from "../../i18n";
import type { FlasherProtocol } from "../../protocols/types";
import type { Transport } from "../../transports/types";

/** 用于外部中断下载的信号（cancel / disconnect 共用）。 */
export const CANCEL_SIGNAL: DownloadError = {
  code: ErrorCode.UserCancelled,
  userMessage: "用户取消",
  debugMessage: "Download session was cancelled externally",
};

export interface DownloadSessionDeps {
  transport: Transport;
  protocol: FlasherProtocol;
  onStageChange?: (stage: DownloadStage) => void;
  onProgress?: (progress: StageProgress) => void;
}

export class DownloadSession {
  private stage: DownloadStage = "idle";
  /** cancel() 已被调用（从 UI 线程），等 run() 的 catch 检测后抛出 UserCancelled。 */
  private _cancelRequested = false;

  constructor(private readonly deps: DownloadSessionDeps) {}

  get currentStage(): DownloadStage {
    return this.stage;
  }

  private move(event: Parameters<typeof transitionStage>[1]): void {
    this.stage = transitionStage(this.stage, event);
    this.deps.onStageChange?.(this.stage);
  }

  async run(input: unknown): Promise<void> {
    try {
      this.move("SELECT_FIRMWARE");
      this.move("START");

      const deferOpen = this.deps.protocol.defersTransportOpen === true;
      if (deferOpen) {
        const ready = this.deps.transport.isDeviceReady?.() ?? false;
        if (!ready) {
          const err: DownloadError = {
            code: ErrorCode.ConnectionFailed,
            userMessage: String(i18n.global.t("flasherPage.selectConnectionFirst")),
            debugMessage: "Serial port is not selected",
          };
          throw err;
        }
      } else {
        await this.deps.transport.open();
      }
      this.move("CONNECT_OK");

      await this.deps.protocol.probe();
      this.move("PROBE_OK");

      await this.deps.protocol.sync();
      this.move("SYNC_OK");

      const plan = await this.deps.protocol.buildPlan(input);
      this.move("PLAN_OK");

      await this.deps.protocol.erase(plan);
      this.move("ERASE_OK");

      await this.deps.protocol.write(plan, (progress) => this.deps.onProgress?.(progress));
      this.move("FLASH_OK");

      if (this.deps.protocol.verify) {
        await this.deps.protocol.verify(plan);
      }
      this.move("VERIFY_OK");

      if (this.deps.protocol.reset) {
        await this.deps.protocol.reset();
      }
      this.move("RESET_OK");
    } catch (cause) {
      this.move("FAIL");
      // cancel() 从 UI 线程调用时 throw 被丢弃，靠此标志位在 run() 里识别
      if (this._cancelRequested) {
        this._cancelRequested = false;
        throw CANCEL_SIGNAL;
      }
      throw this.mapError(cause);
    } finally {
      await this.deps.transport.releaseSession?.().catch(() => undefined);
    }
  }

  cancel(): void {
    if (this.stage === "completed" || this.stage === "failed" || this.stage === "cancelled") return;
    this._cancelRequested = true;
    this.move("CANCEL");
    // 立即中断协议层 I/O（probe/sync 的 AbortController），无需等超时
    this.deps.protocol.abort?.();
    // 取消 transport reader，导致 pending read/write 抛出流错误
    void this.deps.transport.cancel?.();
  }

  reset(): void {
    this.move("RESET");
  }

  private mapError(cause: unknown): DownloadError {
    if (this.isDownloadError(cause)) {
      return cause;
    }
    if (cause instanceof Error && cause.message.includes("Invalid transition")) {
      return { code: ErrorCode.Unknown, userMessage: "状态机异常", debugMessage: cause.message, cause };
    }
    return {
      code: ErrorCode.Unknown,
      userMessage: "下载失败",
      debugMessage: cause instanceof Error ? cause.message : String(cause),
      cause,
    };
  }

  private isDownloadError(value: unknown): value is DownloadError {
    return (
      typeof value === "object" &&
      value !== null &&
      "code" in value &&
      "userMessage" in value &&
      typeof (value as { userMessage?: unknown }).userMessage === "string"
    );
  }
}
