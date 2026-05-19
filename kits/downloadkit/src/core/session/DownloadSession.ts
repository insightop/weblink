import { ErrorCode, type DownloadError } from "@/core/errors/ErrorCode";
import { transitionStage } from "@/core/stateMachine/downloadMachine";
import type { DownloadStage, StageProgress } from "@/core/types/download";
import { i18n } from "@/i18n";
import type { FlasherProtocol } from "@/protocols/types";
import type { Transport } from "@/transports/types";

export interface DownloadSessionDeps {
  transport: Transport;
  protocol: FlasherProtocol;
  onStageChange?: (stage: DownloadStage) => void;
  onProgress?: (progress: StageProgress) => void;
}

export class DownloadSession {
  private stage: DownloadStage = "idle";

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
      throw this.mapError(cause);
    } finally {
      await this.deps.transport.releaseSession?.().catch(() => undefined);
    }
  }

  cancel(): void {
    if (this.stage === "completed" || this.stage === "failed") return;
    this.move("CANCEL");
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
