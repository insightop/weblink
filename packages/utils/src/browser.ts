/** Coarse OS / platform for “open in another browser” heuristics only (not security). */
export type PlatformKind = "ios" | "android" | "mac" | "win" | "other";

export type ExternalBrowserLauncherId = "chrome" | "edge" | "arc";

export interface ExternalBrowserLink {
  id: ExternalBrowserLauncherId;
  href: string;
}

/**
 * Only http(s) page URLs are valid for embedding into browser URL schemes.
 */
export function normalizeHttpPageUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

export function inferPlatformKind(userAgent: string, platform?: string): PlatformKind {
  const ua = userAgent.toLowerCase();
  const plat = (platform ?? "").toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (plat === "macintel" || plat.includes("mac")) return "mac";
  if (plat.includes("win")) return "win";
  return "other";
}

function chromeHref(pageUrl: string): string {
  return `googlechrome://open-url?url=${encodeURIComponent(pageUrl)}`;
}

function edgeHref(pageUrl: string): string {
  return `microsoft-edge:${pageUrl}`;
}

function arcHref(pageUrl: string): string {
  return `arc://open-url?url=${encodeURIComponent(pageUrl)}`;
}

function noopLinks(): ExternalBrowserLink[] {
  return [
    { id: "chrome", href: "#" },
    { id: "edge", href: "#" },
    { id: "arc", href: "#" },
  ];
}

export function buildExternalBrowserLinks(pageUrlRaw: string, _platform: PlatformKind): ExternalBrowserLink[] {
  const pageUrl = normalizeHttpPageUrl(pageUrlRaw);
  if (!pageUrl) return noopLinks();
  return [
    { id: "chrome", href: chromeHref(pageUrl) },
    { id: "edge", href: edgeHref(pageUrl) },
    { id: "arc", href: arcHref(pageUrl) },
  ];
}
