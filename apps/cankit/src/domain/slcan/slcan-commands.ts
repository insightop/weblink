/** Lawicel / slcantty 常见比特率索引（固件可能略有差异） */
export const SLCAN_BITRATE_INDEX: Record<number, string> = {
  10000: "S0",
  20000: "S1",
  50000: "S2",
  100000: "S3",
  125000: "S4",
  250000: "S5",
  500000: "S6",
  800000: "S7",
  1000000: "S8",
};

export type LineEnding = "\r" | "\n" | "\r\n";

export const DEFAULT_LINE_ENDING: LineEnding = "\r";

export function buildOpenCommand(ending: LineEnding = DEFAULT_LINE_ENDING): string {
  return `O${ending}`;
}

export function buildCloseCommand(ending: LineEnding = DEFAULT_LINE_ENDING): string {
  return `C${ending}`;
}

export function buildBitrateCommand(
  bitrateBitsPerSecond: number,
  ending: LineEnding = DEFAULT_LINE_ENDING,
): string | null {
  const cmd = SLCAN_BITRATE_INDEX[bitrateBitsPerSecond];
  return cmd != null ? `${cmd}${ending}` : null;
}
