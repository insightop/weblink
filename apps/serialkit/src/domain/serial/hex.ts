const HEX_RE = /^[0-9a-fA-F]+$/;

export function formatHex(bytes: Uint8Array, group = 1): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    parts.push(b.toString(16).toUpperCase().padStart(2, "0"));
  }
  if (group <= 1) return parts.join(" ");

  const grouped: string[] = [];
  for (let i = 0; i < parts.length; i += group) {
    grouped.push(parts.slice(i, i + group).join(""));
  }
  return grouped.join(" ");
}

export function parseHex(input: string): Uint8Array {
  const cleaned = input
    .replace(/0x/gi, "")
    .replace(/[^0-9a-fA-F]/g, "")
    .trim();

  if (cleaned.length === 0) return new Uint8Array();
  if (!HEX_RE.test(cleaned)) {
    throw new Error("Hex 输入包含非法字符");
  }
  if (cleaned.length % 2 !== 0) {
    throw new Error("Hex 输入长度必须为偶数（每字节 2 位）");
  }

  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    out[i / 2] = Number.parseInt(cleaned.slice(i, i + 2), 16);
  }
  return out;
}
