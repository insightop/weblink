export type LineEnding = "lf" | "crlf";

export function applyLineEnding(text: string, lineEnding: LineEnding): string {
  const v = String(text ?? "");
  if (lineEnding === "crlf") return v.replace(/\n/g, "\r\n");
  return v;
}

export function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(String(text ?? ""));
}

export function createStreamingDecoder(): TextDecoder {
  return new TextDecoder("utf-8", { fatal: false });
}

