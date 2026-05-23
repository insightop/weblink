import { describe, expect, it } from "vitest";
import { buildDnsJsonUrl } from "./buildDnsJsonUrl";

describe("buildDnsJsonUrl", () => {
  it("builds cloudflare query url", () => {
    const r = buildDnsJsonUrl({
      resolverBaseUrl: "https://cloudflare-dns.com/dns-query",
      name: "example.com",
      type: "A",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const u = new URL(r.value);
      expect(u.searchParams.get("name")).toBe("example.com");
      expect(u.searchParams.get("type")).toBe("A");
    }
  });

  it("rejects empty name", () => {
    const r = buildDnsJsonUrl({
      resolverBaseUrl: "https://cloudflare-dns.com/dns-query",
      name: "  ",
      type: "A",
    });
    expect(r.ok).toBe(false);
  });
});
