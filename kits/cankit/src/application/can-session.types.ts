import type { RxFrameRow } from "../domain/can/types.js";

export const DEFAULT_MAX_RX_FRAMES = 2000;

export interface ConnectOptions {
  baudRate: number;
  /** CAN 总线比特率（Lawicel Sx）；null 表示不发送 S 命令 */
  canBitrate: number | null;
}

/** WebUSB gs_usb：仅需 CAN 比特率（由 gs_device_bittiming 下发） */
export interface GsUsbConnectOptions {
  canBitrate: number;
}

export type SessionEvent =
  | { type: "rx"; row: RxFrameRow }
  | { type: "parse_error"; line: string; message: string }
  | { type: "read_error"; error: unknown };
