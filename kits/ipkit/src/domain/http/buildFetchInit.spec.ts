import { describe, expect, it } from "vitest";
import { buildFetchInit } from "./buildFetchInit";

describe("buildFetchInit", () => {
  it("builds GET without body", () => {
    const r = buildFetchInit({
      method: "get",
      url: "https://example.com/path",
      headersText: "X-Test: 1",
      bodyText: "ignored",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.init.method).toBe("GET");
      expect(r.value.init.body).toBeNull();
    }
  });

  it("rejects non-http url", () => {
    const r = buildFetchInit({
      method: "GET",
      url: "ftp://example.com",
      headersText: "",
      bodyText: "",
    });
    expect(r.ok).toBe(false);
  });
});
