/** 11-bit / 29-bit CAN 标识符模式 */
export type CanIdMode = "standard" | "extended";

/** 经典 CAN 数据帧（slcan 文本侧） */
export interface CanFrame {
  id: number;
  extended: boolean;
  dlc: number;
  data: Uint8Array;
}

export type SlcanFrameDirection = "rx" | "tx";

export interface SlcanDataFrame extends CanFrame {
  direction: SlcanFrameDirection;
}

/** 带序号与时间的接收展示项 */
export interface RxFrameRow {
  seq: number;
  ts: number;
  frame: SlcanDataFrame;
}
