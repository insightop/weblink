export function formatHex(bytes: Uint8Array, group = 1): string {
  if (bytes.length === 0) return "";
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const v = bytes[i] ?? 0;
    parts.push(v.toString(16).toUpperCase().padStart(2, "0"));
  }
  if (group <= 1) return parts.join(" ");
  const grouped: string[] = [];
  for (let i = 0; i < parts.length; i += group) grouped.push(parts.slice(i, i + group).join(""));
  return grouped.join(" ");
}

export function parseHex(input: string): Uint8Array {
  const raw = String(input ?? "").trim();
  if (!raw) return new Uint8Array();

  const cleaned = raw
    .replace(/0x/gi, "")
    .replace(/[\s,_-]/g, "")
    .toUpperCase();

  if (!/^[0-9A-F]*$/.test(cleaned)) {
    throw new Error("非法 HEX：仅允许 0-9A-F 与分隔符");
  }
  if (cleaned.length % 2 !== 0) {
    throw new Error("非法 HEX：长度必须为偶数（每字节 2 个字符）");
  }

  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) {
    const hex = cleaned.slice(i * 2, i * 2 + 2);
    out[i] = Number.parseInt(hex, 16);
  }
  return out;
}

