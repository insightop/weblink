import type { SlcanDataFrame } from "../can/types.js";
import { CanKitError } from "../errors/can-kit-error.js";
import {
  CAN_EFF_FLAG,
  CAN_ERR_FLAG,
  CAN_EFF_MASK,
  CAN_RTR_FLAG,
  GS_HOST_FRAME_SIZE,
  GS_USB_RX_ECHO_ID,
} from "./gs-usb-constants.js";

/** 组包 can_id（经典 / 扩展），与 Linux SocketCAN 一致 */
export function buildGsUsbCanId(id: number, extended: boolean): number {
  if (extended) {
    return (id & CAN_EFF_MASK) | CAN_EFF_FLAG;
  }
  return id & 0x7ff;
}

/** 解析 can_id 为仲裁域与标志 */
export function parseGsUsbCanId(raw: number): {
  id: number;
  extended: boolean;
  isRtr: boolean;
  isErr: boolean;
} {
  return {
    id: raw & CAN_EFF_MASK,
    extended: (raw & CAN_EFF_FLAG) !== 0,
    isRtr: (raw & CAN_RTR_FLAG) !== 0,
    isErr: (raw & CAN_ERR_FLAG) !== 0,
  };
}

/**
 * 解码一帧 struct gs_host_frame（20 字节，无 HW timestamp）。
 * echo_id == 0xffffffff 表示 RX。
 */
export function decodeGsHostFrame(buf: ArrayBuffer): SlcanDataFrame | null {
  if (buf.byteLength < GS_HOST_FRAME_SIZE) {
    throw new CanKitError(
      "GSUSB_DECODE",
      `帧长度不足: ${buf.byteLength} < ${GS_HOST_FRAME_SIZE}`,
    );
  }
  const v = new DataView(buf, 0, GS_HOST_FRAME_SIZE);
  const echoId = v.getUint32(0, true);
  const canId = v.getUint32(4, true);
  const canDlc = v.getUint8(8);
  const flags = v.getUint8(10);
  void v.getUint8(9);
  void v.getUint8(11);
  void flags;

  const { id, extended, isRtr, isErr } = parseGsUsbCanId(canId);
  if (isErr) {
    return null;
  }

  const dlc = Math.min(canDlc & 0x0f, 8);
  const data = new Uint8Array(dlc);
  for (let i = 0; i < dlc; i++) {
    data[i] = v.getUint8(12 + i);
  }

  const direction = echoId === GS_USB_RX_ECHO_ID ? "rx" : "tx";

  return {
    id: extended ? id & CAN_EFF_MASK : id & 0x7ff,
    extended,
    dlc,
    data: isRtr ? new Uint8Array(0) : data,
    direction,
  };
}

let txEchoSeq = 0;

function nextEchoId(): number {
  txEchoSeq = (txEchoSeq % 0xfffe) + 1;
  return txEchoSeq;
}

/** 编码发送帧为 20 字节 bulk OUT */
export function encodeGsHostFrameTx(payload: {
  id: number;
  extended: boolean;
  dlc: number;
  data: Uint8Array;
}): ArrayBuffer {
  if (payload.dlc < 0 || payload.dlc > 8) {
    throw new CanKitError("INVALID_ARGUMENT", `DLC 须在 0-8: ${payload.dlc}`);
  }
  if (payload.data.length !== payload.dlc) {
    throw new CanKitError("INVALID_ARGUMENT", "data 长度须等于 DLC");
  }
  const buf = new ArrayBuffer(GS_HOST_FRAME_SIZE);
  const v = new DataView(buf);
  const echoId = nextEchoId();
  const canId = buildGsUsbCanId(payload.id, payload.extended);

  v.setUint32(0, echoId, true);
  v.setUint32(4, canId, true);
  v.setUint8(8, payload.dlc);
  v.setUint8(9, 0);
  v.setUint8(10, 0);
  v.setUint8(11, 0);
  for (let i = 0; i < 8; i++) {
    v.setUint8(12 + i, i < payload.dlc ? payload.data[i]! : 0);
  }
  return buf;
}
