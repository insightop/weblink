export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export function sliceTail(bytes: Uint8Array, maxBytes: number): Uint8Array {
  if (bytes.length <= maxBytes) return bytes;
  return bytes.slice(bytes.length - maxBytes);
}

export function appendBytesTail(
  prev: Uint8Array,
  next: Uint8Array,
  maxBytes: number,
): Uint8Array {
  const total = prev.length + next.length;
  if (total <= maxBytes) {
    const out = new Uint8Array(total);
    out.set(prev, 0);
    out.set(next, prev.length);
    return out;
  }

  // 只保留尾部 maxBytes
  const out = new Uint8Array(maxBytes);
  const keepFromPrev = Math.max(0, maxBytes - next.length);
  const prevStart = Math.max(0, prev.length - keepFromPrev);
  out.set(prev.slice(prevStart), 0);
  out.set(next.slice(Math.max(0, next.length - maxBytes)), keepFromPrev);
  return out;
}
