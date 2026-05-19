export interface ResponseHeaderEntry {
  name: string;
  value: string;
}

export interface HttpResponseSummary {
  url: string;
  status: number;
  statusText: string;
  ok: boolean;
  redirected: boolean;
  type: globalThis.Response["type"];
  headers: ResponseHeaderEntry[];
  bodyText: string;
  bodyTruncated: boolean;
  bodyBytesRead: number;
}

export function snapshotResponseHeaders(response: Response): ResponseHeaderEntry[] {
  const out: ResponseHeaderEntry[] = [];
  response.headers.forEach((value, name) => {
    out.push({ name, value });
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readResponseBodyWithLimit(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean; bytesRead: number }> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    const bytes = new TextEncoder().encode(text);
    if (bytes.byteLength > maxBytes) {
      const slice = bytes.slice(0, maxBytes);
      return {
        text: new TextDecoder().decode(slice) + "\n…（已截断）",
        truncated: true,
        bytesRead: maxBytes,
      };
    }
    return { text, truncated: false, bytesRead: bytes.byteLength };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      if (total + value.byteLength > maxBytes) {
        const rest = maxBytes - total;
        if (rest > 0) {
          chunks.push(value.slice(0, rest));
        }
        total = maxBytes;
        const merged = mergeChunks(chunks);
        return {
          text: new TextDecoder().decode(merged) + "\n…（已截断）",
          truncated: true,
          bytesRead: total,
        };
      }
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const merged = mergeChunks(chunks);
  return {
    text: new TextDecoder().decode(merged),
    truncated: false,
    bytesRead: total,
  };
}

function mergeChunks(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 0) {
    return new Uint8Array(0);
  }
  if (chunks.length === 1) {
    return chunks[0];
  }
  const total = chunks.reduce((s, c) => s + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export async function buildHttpResponseSummary(
  response: Response,
  maxBodyBytes: number,
): Promise<HttpResponseSummary> {
  const { text, truncated, bytesRead } = await readResponseBodyWithLimit(response, maxBodyBytes);
  return {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    redirected: response.redirected,
    type: response.type,
    headers: snapshotResponseHeaders(response),
    bodyText: text,
    bodyTruncated: truncated,
    bodyBytesRead: bytesRead,
  };
}
