const isDev = import.meta.env.DEV;

export function logDebug(...args: unknown[]): void {
  if (isDev) console.debug("[cankit]", ...args);
}

export function logInfo(...args: unknown[]): void {
  console.info("[cankit]", ...args);
}

export function logWarn(...args: unknown[]): void {
  console.warn("[cankit]", ...args);
}

export function logError(...args: unknown[]): void {
  console.error("[cankit]", ...args);
}
