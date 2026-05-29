import type { FlashPlan, StageProgress } from "../core/types/download";
import type { Transport } from "../transports/types";

export interface ProbeResult {
  chipFamily: "stm32" | "esp32" | "gd32" | "ch32";
  chipName: string;
}

export interface FlasherProtocol {
  /**
   * When true, `DownloadSession` will not call `transport.open()` before `probe()`.
   * Use for vendors (e.g. esptool-js) that open the same `SerialPort` inside `probe`.
   */
  readonly defersTransportOpen?: boolean;
  probe(): Promise<ProbeResult>;
  sync(): Promise<void>;
  buildPlan(input: unknown): Promise<FlashPlan>;
  erase(plan: FlashPlan): Promise<void>;
  write(plan: FlashPlan, onProgress: (progress: StageProgress) => void): Promise<void>;
  verify?(plan: FlashPlan): Promise<void>;
  reset?(): Promise<void>;
  /** 中断当前进行中的 I/O 操作（probe/sync 等阶段），让 pending read 立即抛错。 */
  abort?(): void;
}

export interface ProtocolContext {
  transport: Transport;
}
