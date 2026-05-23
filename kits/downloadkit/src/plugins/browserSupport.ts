import type { BrowserCapabilities } from "./types";
import { inferPlatformKind, type PlatformKind } from "@weblink/utils/browser";

/** Token for i18n `browser.names.{key}` only; not used for capability gating. */
export type BrowserMarketingKey =
  | "safari"
  | "chrome"
  | "edge"
  | "arc"
  | "firefox"
  | "opera"
  | "samsung"
  | "webview"
  | "unknown";

export interface BrowserSupportState {
  capabilities: BrowserCapabilities;
  needsCapabilityOverlay: boolean;
  platformKind: PlatformKind;
  isLikelySafariWebKit: boolean;
  browserMarketingKey: BrowserMarketingKey;
}

/**
 * Derive a short browser label bucket from UA for user-facing copy. Order-sensitive.
 */
export function inferBrowserMarketingKey(userAgent: string): BrowserMarketingKey {
  if (!userAgent.trim()) return "unknown";
  if (/MicroMessenger/i.test(userAgent)) return "webview";
  if (/\bEdg\//i.test(userAgent) || /\bEdgiOS\//i.test(userAgent)) return "edge";
  if (/\bOPR\//i.test(userAgent) || /\bOpera\b/i.test(userAgent)) return "opera";
  if (/SamsungBrowser/i.test(userAgent)) return "samsung";
  if (/\bFirefox\b|FxiOS/i.test(userAgent)) return "firefox";
  if (/\bArc\//i.test(userAgent)) return "arc";
  if (/\bChrome\b|CriOS|CrMo/i.test(userAgent)) return "chrome";
  if (/Safari/i.test(userAgent) && !/(Chrome|CriOS|\bEdg)/i.test(userAgent)) return "safari";
  return "unknown";
}

/**
 * `needsCapabilityOverlay` mirrors legacy `blocked`: no Web Serial / USB / HID.
 * UA hints are for copy only, not capability detection.
 */
export function evaluateBrowserSupport(
  capabilities: BrowserCapabilities,
  userAgent: string,
  platform: string,
): BrowserSupportState {
  const needsCapabilityOverlay =
    !capabilities.webSerial && !capabilities.webUsb && !capabilities.webHid;
  const platformKind = inferPlatformKind(userAgent, platform);
  const uaLower = userAgent.toLowerCase();
  const isLikelySafariWebKit =
    /safari/.test(uaLower) && !/chrom(e|ium)|crios|fxios|edgios|edg\//.test(uaLower);
  const browserMarketingKey = inferBrowserMarketingKey(userAgent);

  return {
    capabilities,
    needsCapabilityOverlay,
    platformKind,
    isLikelySafariWebKit,
    browserMarketingKey,
  };
}
