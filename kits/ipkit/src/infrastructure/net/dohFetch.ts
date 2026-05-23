import { IpKitError, IpKitErrorCode } from "../../domain/errors/IpKitError";
import { parseDohJson } from "../../domain/doh/parseDohResponse";
import type { DnsJsonDocument } from "../../domain/doh/parseDohResponse";
import { createLogger } from "../logger/createLogger";

const log = createLogger("dohFetch");

export interface DohFetchResult {
  rawText: string;
  document: DnsJsonDocument;
}

export async function fetchDnsJson(
  url: string,
  options?: { signal?: AbortSignal },
): Promise<DohFetchResult> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/dns-json",
      },
      signal: options?.signal,
    });
  } catch (e) {
    if (options?.signal?.aborted) {
      throw new IpKitError(IpKitErrorCode.ABORTED, "请求已取消", { cause: e });
    }
    throw IpKitError.fromUnknown(
      IpKitErrorCode.NETWORK,
      e,
      "DoH 请求失败（可能是 CORS 或网络错误）",
    );
  }

  const text = await response.text();
  if (!response.ok) {
    log.warn("non-ok", response.status, text.slice(0, 200));
    throw new IpKitError(IpKitErrorCode.NETWORK, `HTTP ${response.status}`, {
      details: { body: text.slice(0, 500) },
    });
  }

  const parsed = parseDohJson(text);
  if (!parsed.ok) {
    throw parsed.error;
  }

  return { rawText: text, document: parsed.value };
}
