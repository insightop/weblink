export interface IpKitCapabilities {
  secureContext: boolean;
  fetch: boolean;
  webSocket: boolean;
  webTransport: boolean;
}

export function detectCapabilities(): IpKitCapabilities {
  const g = globalThis as typeof globalThis & {
    WebTransport?: unknown;
  };
  return {
    secureContext: typeof window !== "undefined" && window.isSecureContext,
    fetch: typeof globalThis.fetch === "function",
    webSocket: typeof globalThis.WebSocket === "function",
    webTransport: typeof g.WebTransport === "function",
  };
}
