export function uint8ToHex(data: Uint8Array, maxBytes = 256): string {
  const n = Math.min(data.length, maxBytes);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push((data[i] ?? 0).toString(16).padStart(2, "0"));
  }
  const suffix = data.length > maxBytes ? " …" : "";
  return parts.join(" ") + suffix;
}
