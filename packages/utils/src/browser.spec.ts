import { describe, expect, it } from "vitest";
import { buildExternalBrowserLinks, inferPlatformKind, normalizeHttpPageUrl } from "./browser";

describe("normalizeHttpPageUrl", () => {
  it("accepts https URLs", () => {
    expect(normalizeHttpPageUrl("https://a.test/path?q=1")).toBe("https://a.test/path?q=1");
  });

  it("rejects non-http(s)", () => {
    expect(normalizeHttpPageUrl("file:///tmp/x")).toBeNull();
    expect(normalizeHttpPageUrl("blob:https://x")).toBeNull();
  });
});

describe("buildExternalBrowserLinks", () => {
  it("returns chrome edge arc in order", () => {
    const links = buildExternalBrowserLinks("https://x.test/", "win");
    expect(links.map((l) => l.id)).toEqual(["chrome", "edge", "arc"]);
  });

  it("includes encoded page URL in chrome href", () => {
    const links = buildExternalBrowserLinks("https://example.com/p?q=1", "mac");
    const chrome = links.find((l) => l.id === "chrome");
    expect(chrome).toBeDefined();
    expect(chrome?.href).toContain(encodeURIComponent("https://example.com/p?q=1"));
  });

  it("uses microsoft-edge scheme for edge link", () => {
    const links = buildExternalBrowserLinks("https://foo.test/", "win");
    const edge = links.find((l) => l.id === "edge");
    expect(edge?.href).toBe("microsoft-edge:https://foo.test/");
  });

  it("uses arc open-url scheme", () => {
    const links = buildExternalBrowserLinks("https://foo.test/bar", "mac");
    const arc = links.find((l) => l.id === "arc");
    expect(arc?.href).toBe(`arc://open-url?url=${encodeURIComponent("https://foo.test/bar")}`);
  });

  it("returns noop links when page URL is not http(s)", () => {
    const links = buildExternalBrowserLinks("file:///tmp/x", "mac");
    expect(links.every((l) => l.href === "#")).toBe(true);
  });
});

describe("inferPlatformKind", () => {
  it("detects iOS", () => {
    expect(inferPlatformKind("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "")).toBe(
      "ios",
    );
  });

  it("detects android", () => {
    expect(inferPlatformKind("Mozilla/5.0 (Linux; Android 12)", "")).toBe("android");
  });
});
