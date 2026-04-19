export type LineEnding = "none" | "lf" | "crlf";

export function applyLineEnding(text: string, lineEnding: LineEnding): string {
  if (lineEnding === "lf") return text + "\n";
  if (lineEnding === "crlf") return text + "\r\n";
  return text;
}

export function encodeText(text: string, lineEnding: LineEnding): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(applyLineEnding(text, lineEnding));
}

export function createStreamingDecoder(): TextDecoder {
  return new TextDecoder("utf-8", { fatal: false });
}
