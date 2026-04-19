import { describe, expect, it } from "vitest";
import { evaluateBrowserSupport, inferBrowserMarketingKey } from "@/plugins/browserSupport";

describe("evaluateBrowserSupport", () => {
  it("needs overlay when no hardware APIs", () => {
    const s = evaluateBrowserSupport(
      { webSerial: false, webUsb: false, webHid: false },
      "",
      "",
    );
    expect(s.needsCapabilityOverlay).toBe(true);
  });

  it("does not need overlay when any API is available", () => {
    const s = evaluateBrowserSupport(
      { webSerial: true, webUsb: false, webHid: false },
      "",
      "",
    );
    expect(s.needsCapabilityOverlay).toBe(false);
  });

  it("flags Safari-like UA without Chrome token", () => {
    const s = evaluateBrowserSupport(
      { webSerial: false, webUsb: false, webHid: false },
      "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      "MacIntel",
    );
    expect(s.isLikelySafariWebKit).toBe(true);
  });

  it("does not flag Chrome as Safari", () => {
    const s = evaluateBrowserSupport(
      { webSerial: false, webUsb: true, webHid: false },
      "Mozilla/5.0 Chrome/120.0 Safari/537.36",
      "",
    );
    expect(s.isLikelySafariWebKit).toBe(false);
  });

  it("includes browserMarketingKey in state", () => {
    const s = evaluateBrowserSupport(
      { webSerial: false, webUsb: false, webHid: false },
      "Mozilla/5.0 (Macintosh) Version/17.0 Safari/605.1.15",
      "MacIntel",
    );
    expect(s.browserMarketingKey).toBe("safari");
  });
});

describe("inferBrowserMarketingKey", () => {
  it("detects Edge", () => {
    expect(inferBrowserMarketingKey("Mozilla/5.0 Edg/120.0")).toBe("edge");
  });

  it("detects Chrome", () => {
    expect(inferBrowserMarketingKey("Mozilla/5.0 Chrome/120.0 Safari/537.36")).toBe("chrome");
  });

  it("detects Arc before Chrome substring heuristics", () => {
    expect(inferBrowserMarketingKey("Mozilla/5.0 Arc/1.2 Chrome/120")).toBe("arc");
  });

  it("returns unknown for empty UA", () => {
    expect(inferBrowserMarketingKey("")).toBe("unknown");
  });
});
