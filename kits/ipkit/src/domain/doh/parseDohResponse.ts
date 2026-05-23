import { IpKitError, IpKitErrorCode } from "../errors/IpKitError";
import type { Result } from "../result";
import { err, ok } from "../result";

/** Cloudflare / Google dns-json 响应的最小可展示结构 */
export interface DnsJsonAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

export interface DnsJsonDocument {
  Status: number;
  TC: boolean;
  RD: boolean;
  RA: boolean;
  AD: boolean;
  CD: boolean;
  Question?: Array<{ name: string; type: number }>;
  Answer?: DnsJsonAnswer[];
  Authority?: DnsJsonAnswer[];
  Additional?: DnsJsonAnswer[];
  Comment?: string;
}

export function parseDohJson(text: string): Result<DnsJsonDocument> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return err(IpKitError.fromUnknown(IpKitErrorCode.PARSE, e, "响应不是合法 JSON"));
  }
  if (typeof parsed !== "object" || parsed === null || !("Status" in parsed)) {
    return err(new IpKitError(IpKitErrorCode.PARSE, "dns-json 格式异常：缺少 Status 字段"));
  }
  return ok(parsed as DnsJsonDocument);
}

export function dnsStatusDescription(status: number): string {
  const map: Record<number, string> = {
    0: "NOERROR",
    1: "FORMERR",
    2: "SERVFAIL",
    3: "NXDOMAIN",
    4: "NOTIMP",
    5: "REFUSED",
  };
  return map[status] ?? `UNKNOWN(${status})`;
}
