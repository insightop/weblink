import { IpKitError, IpKitErrorCode } from "@/domain/errors/IpKitError";
import type { Result } from "@/domain/result";
import { err, ok } from "@/domain/result";

const ALLOWED_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;

export type HttpMethod = (typeof ALLOWED_METHODS)[number];

export interface HttpRequestDraft {
  method: string;
  url: string;
  headersText: string;
  bodyText: string;
}

function parseHeadersBlock(text: string): Result<Headers> {
  const headers = new Headers();
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }
    const colon = line.indexOf(":");
    if (colon <= 0) {
      return err(
        new IpKitError(IpKitErrorCode.VALIDATION, `请求头第 ${i + 1} 行格式无效，应为 Key: Value`, {
          details: { line: String(i + 1) },
        }),
      );
    }
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (!key) {
      return err(
        new IpKitError(IpKitErrorCode.VALIDATION, `请求头第 ${i + 1} 行缺少字段名`, {
          details: { line: String(i + 1) },
        }),
      );
    }
    headers.append(key, value);
  }
  return ok(headers);
}

export function normalizeMethod(method: string): Result<HttpMethod> {
  const upper = method.trim().toUpperCase();
  if (!ALLOWED_METHODS.includes(upper as HttpMethod)) {
    return err(
      new IpKitError(IpKitErrorCode.VALIDATION, `不支持的 HTTP 方法：${method}`, {
        details: { method },
      }),
    );
  }
  return ok(upper as HttpMethod);
}

export function buildFetchInit(
  draft: HttpRequestDraft,
): Result<{ url: string; init: RequestInit }> {
  const url = draft.url.trim();
  if (!url) {
    return err(new IpKitError(IpKitErrorCode.VALIDATION, "URL 不能为空"));
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return err(new IpKitError(IpKitErrorCode.VALIDATION, "URL 格式无效"));
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return err(
      new IpKitError(IpKitErrorCode.VALIDATION, "仅支持 http(s) URL", {
        details: { protocol: parsed.protocol },
      }),
    );
  }

  const methodResult = normalizeMethod(draft.method);
  if (!methodResult.ok) {
    return methodResult;
  }
  const method = methodResult.value;

  const headersResult = parseHeadersBlock(draft.headersText);
  if (!headersResult.ok) {
    return headersResult;
  }
  const headers = headersResult.value;

  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody && draft.bodyText.length > 0 ? draft.bodyText : undefined;

  if (body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "text/plain;charset=UTF-8");
  }

  const init: RequestInit = {
    method,
    headers,
    body: body ?? null,
  };

  return ok({ url: parsed.href, init });
}
