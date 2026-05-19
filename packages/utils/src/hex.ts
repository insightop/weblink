const HEX_RE = /^[0-9a-fA-F]+$/;

export function formatHex(bytes: Uint8Array, group = 1): string {
  if (bytes.length === 0) return "";
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
  const raw = String(input ?? "").trim();
  if (!raw) return new Uint8Array();

  const cleaned = raw
    .replace(/0x/gi, "")
    .replace(/[\s,_-]/g, "")
    .toUpperCase();

  if (!HEX_RE.test(cleaned)) {
    throw new Error("Hex input contains invalid characters");
  }
  if (cleaned.length % 2 !== 0) {
    throw new Error("Hex input length must be even (2 characters per byte)");
  }

  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function parseHexBytes(s: string): Uint8Array {
  const t = s.replace(/\s+/g, "");
  if (t.length % 2 !== 0) {
    throw new Error("Hex string length must be even");
  }
  const out = new Uint8Array(t.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(t.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function formatHexId(id: number, extended: boolean): string {
  const w = extended ? 8 : 3;
  return `0x${id.toString(16).toUpperCase().padStart(w, "0")}`;
}

export function formatDataHex(data: Uint8Array): string {
  return Array.from(data, (b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
}
