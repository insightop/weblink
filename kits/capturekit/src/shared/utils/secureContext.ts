/** 是否为可安全使用 getUserMedia 的上下文（HTTPS 或 localhost） */
export function isSecureMediaContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext === true;
}
