/** 查找第一个行结束符：\r\n、\n、\r */
function findLineEnd(s: string): { index: number; skip: number } | null {
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === "\r" && s[i + 1] === "\n") {
      return { index: i, skip: 2 };
    }
    if (c === "\n") {
      return { index: i, skip: 1 };
    }
    if (c === "\r") {
      return { index: i, skip: 1 };
    }
  }
  return null;
}

export function createLineAccumulator(): {
  push(chunk: string): string[];
  flushRemainder(): string | null;
} {
  let buf = "";

  return {
    push(chunk: string): string[] {
      buf += chunk;
      const lines: string[] = [];
      while (true) {
        const e = findLineEnd(buf);
        if (!e) break;
        const line = buf.slice(0, e.index);
        buf = buf.slice(e.index + e.skip);
        lines.push(line);
      }
      return lines;
    },
    flushRemainder(): string | null {
      const t = buf.trim();
      buf = "";
      return t.length ? t : null;
    },
  };
}

/** 从 UTF-8 字节流异步迭代完整行（不含行尾） */
export async function* iterateLinesFromUtf8Stream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, undefined> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const acc = createLineAccumulator();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        const text = decoder.decode(value, { stream: true });
        for (const line of acc.push(text)) {
          yield line;
        }
      }
    }
    const tail = decoder.decode();
    for (const line of acc.push(tail)) {
      yield line;
    }
    const rest = acc.flushRemainder();
    if (rest) yield rest;
  } finally {
    reader.releaseLock();
  }
}
