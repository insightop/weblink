import { IpKitError, IpKitErrorCode } from "../errors/IpKitError";
import type { Result } from "../result";
import { err, ok } from "../result";

/** 常用 RR 类型名（Cloudflare dns-json） */
export const DNS_JSON_TYPES = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "NS",
  "PTR",
  "SOA",
  "SRV",
  "TXT",
  "CAA",
] as const;

export type DnsJsonType = (typeof DNS_JSON_TYPES)[number];

export interface DnsJsonQuery {
  resolverBaseUrl: string;
  name: string;
  type: DnsJsonType;
}

export function buildDnsJsonUrl(query: DnsJsonQuery): Result<string> {
  const name = query.name.trim();
  if (!name) {
    return err(new IpKitError(IpKitErrorCode.VALIDATION, "域名不能为空"));
  }

  let base: URL;
  try {
    base = new URL(query.resolverBaseUrl);
  } catch {
    return err(new IpKitError(IpKitErrorCode.VALIDATION, "解析器 URL 无效"));
  }

  if (base.pathname !== "/dns-query" && base.pathname !== "/resolve") {
    // 允许完整路径已写在 base 里
  }

  base.searchParams.set("name", name);
  base.searchParams.set("type", query.type);

  return ok(base.href);
}
