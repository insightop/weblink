import type { SlcanDataFrame } from "../can/types.js";
import { CanKitError, SlcanParseError } from "../errors/can-kit-error.js";

const STD_PREFIX = new Set(["r", "t"]);
const EXT_PREFIX = new Set(["R", "T"]);

function parseHexBytePair(pair: string, ctx: string): number {
  if (pair.length !== 2) {
    throw new SlcanParseError(`无效十六进制字节: ${pair}`, ctx);
  }
  const n = Number.parseInt(pair, 16);
  if (!Number.isFinite(n) || n < 0 || n > 255) {
    throw new SlcanParseError(`字节越界: ${pair}`, ctx);
  }
  return n;
}

function parseStdId(idHex: string, raw: string): number {
  if (!/^[0-9A-Fa-f]{3}$/.test(idHex)) {
    throw new SlcanParseError(`标准 ID 须为 3 个十六进制字符: ${idHex}`, raw);
  }
  const id = Number.parseInt(idHex, 16);
  if (id > 0x7ff) {
    throw new SlcanParseError(`标准 ID 超过 11 位: 0x${idHex}`, raw);
  }
  return id;
}

function parseExtId(idHex: string, raw: string): number {
  if (!/^[0-9A-Fa-f]{8}$/.test(idHex)) {
    throw new SlcanParseError(`扩展 ID 须为 8 个十六进制字符: ${idHex}`, raw);
  }
  const id = Number.parseInt(idHex, 16);
  if (id > 0x1fffffff) {
    throw new SlcanParseError(`扩展 ID 超过 29 位: 0x${idHex}`, raw);
  }
  return id;
}

function directionFromPrefix(c: string): "rx" | "tx" {
  if (c === "r" || c === "R") return "rx";
  if (c === "t" || c === "T") return "tx";
  throw new SlcanParseError(`未知方向前缀: ${c}`, c);
}

/** 解析单行 slcan（无行尾换行）。成功返回数据帧；非数据帧返回 null。 */
export function tryDecodeDataFrameLine(trimmedLine: string): SlcanDataFrame | null {
  const line = trimmedLine.trim();
  if (line.length < 2) return null;

  const head = line[0]!;
  if (!STD_PREFIX.has(head) && !EXT_PREFIX.has(head)) {
    return null;
  }

  const extended = head === "R" || head === "T";
  const idLen = extended ? 8 : 3;
  const idHex = line.slice(1, 1 + idLen);
  const dlcChar = line[1 + idLen];
  if (dlcChar == null || !/[0-8]/.test(dlcChar)) {
    throw new SlcanParseError(`无效 DLC: ${String(dlcChar)}`, line);
  }
  const dlc = Number(dlcChar);

  const dataHex = line.slice(2 + idLen);
  if (dataHex.length !== dlc * 2) {
    throw new SlcanParseError(
      `数据长度与 DLC 不符: dlc=${dlc} 期望 ${dlc * 2} 个十六进制字符，实际 ${dataHex.length}`,
      line,
    );
  }

  const id = extended ? parseExtId(idHex, line) : parseStdId(idHex, line);
  const data = new Uint8Array(dlc);
  for (let i = 0; i < dlc; i++) {
    data[i] = parseHexBytePair(dataHex.slice(i * 2, i * 2 + 2), line);
  }

  return {
    id,
    extended,
    dlc,
    data,
    direction: directionFromPrefix(head),
  };
}

/** 编码为发送行（标准 t / 扩展 T），不含换行符 */
export function encodeTransmitLine(frame: {
  id: number;
  extended: boolean;
  dlc: number;
  data: Uint8Array;
}): string {
  if (frame.dlc < 0 || frame.dlc > 8) {
    throw new CanKitError("INVALID_ARGUMENT", `DLC 必须在 0-8: ${frame.dlc}`);
  }
  if (frame.data.length !== frame.dlc) {
    throw new CanKitError(
      "INVALID_ARGUMENT",
      `data 长度须等于 DLC: dlc=${frame.dlc} len=${frame.data.length}`,
    );
  }
  if (frame.extended) {
    if (frame.id < 0 || frame.id > 0x1fffffff) {
      throw new CanKitError("INVALID_ARGUMENT", `扩展 ID 越界: ${frame.id}`);
    }
    const idHex = frame.id.toString(16).toUpperCase().padStart(8, "0");
    let hex = "";
    for (let i = 0; i < frame.dlc; i++) {
      hex += frame.data[i]!.toString(16).toUpperCase().padStart(2, "0");
    }
    return `T${idHex}${String(frame.dlc)}${hex}`;
  }
  if (frame.id < 0 || frame.id > 0x7ff) {
    throw new CanKitError("INVALID_ARGUMENT", `标准 ID 越界: ${frame.id}`);
  }
  const idHex = frame.id.toString(16).toUpperCase().padStart(3, "0");
  let hex = "";
  for (let i = 0; i < frame.dlc; i++) {
    hex += frame.data[i]!.toString(16).toUpperCase().padStart(2, "0");
  }
  return `t${idHex}${String(frame.dlc)}${hex}`;
}
