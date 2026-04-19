export function formatHexId(id: number, extended: boolean): string {
  const w = extended ? 8 : 3;
  return `0x${id.toString(16).toUpperCase().padStart(w, "0")}`;
}

export function formatDataHex(data: Uint8Array): string {
  return Array.from(data, (b) => b.toString(16).toUpperCase().padStart(2, "0")).join(
    " ",
  );
}

export function parseHexBytes(s: string): Uint8Array {
  const t = s.replace(/\s+/g, "");
  if (t.length % 2 !== 0) {
    throw new Error("十六进制长度须为偶数");
  }
  const out = new Uint8Array(t.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(t.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
