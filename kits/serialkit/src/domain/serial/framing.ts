export type LineFramerOptions = {
  maxLineLength?: number;
};

export class LineFramer {
  private buf = "";
  private readonly maxLineLength: number;

  constructor(opts: LineFramerOptions = {}) {
    this.maxLineLength = opts.maxLineLength ?? 8192;
  }

  push(textChunk: string): string[] {
    if (!textChunk) return [];
    this.buf += textChunk;

    if (this.buf.length > this.maxLineLength * 4) {
      // 防止长时间无换行导致内存增长：保留尾部
      this.buf = this.buf.slice(-this.maxLineLength);
    }

    const lines: string[] = [];
    let idx: number;
    while ((idx = this.buf.indexOf("\n")) !== -1) {
      const raw = this.buf.slice(0, idx);
      // 去掉可能的 \r
      lines.push(raw.endsWith("\r") ? raw.slice(0, -1) : raw);
      this.buf = this.buf.slice(idx + 1);
    }

    return lines;
  }

  flush(): string | null {
    const rest = this.buf;
    this.buf = "";
    return rest.length ? rest : null;
  }
}

export type ByteLineFramerOptions = {
  /** 单行最大字节数（防爆内存） */
  maxLineBytes?: number;
};

/** 按 \\n(0x0A) 将字节流切分为“行”，用于 Text/Hex 行对齐展示 */
export class ByteLineFramer {
  private carry = new Uint8Array();
  private readonly maxLineBytes: number;

  constructor(opts: ByteLineFramerOptions = {}) {
    this.maxLineBytes = opts.maxLineBytes ?? 64 * 1024;
  }

  push(chunk: Uint8Array): Uint8Array[] {
    if (!chunk.length) return [];
    const data =
      this.carry.length === 0
        ? chunk
        : new Uint8Array([...this.carry, ...chunk]);

    const lines: Uint8Array[] = [];
    let start = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === 0x0a) {
        const line = data.slice(start, i); // 不含 \n
        lines.push(this.trimCROnEnd(line));
        start = i + 1;
      }
    }

    this.carry = data.slice(start);
    if (this.carry.length > this.maxLineBytes * 4) {
      // 长时间无换行：保留尾部
      this.carry = this.carry.slice(-this.maxLineBytes);
    }

    return lines.map((l) => (l.length > this.maxLineBytes ? l.slice(0, this.maxLineBytes) : l));
  }

  flush(): Uint8Array | null {
    const rest = this.carry;
    this.carry = new Uint8Array();
    return rest.length ? this.trimCROnEnd(rest) : null;
  }

  private trimCROnEnd(bytes: Uint8Array): Uint8Array {
    if (bytes.length === 0) return bytes;
    return bytes[bytes.length - 1] === 0x0d ? bytes.slice(0, -1) : bytes;
  }
}
