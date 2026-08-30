/**
 * 浏览器能力检测（features 层纯函数）：直读全局判断配网前置能力。
 * 缺全局（SSR / 旧浏览器）时安全返回 false，不抛错。
 */

/** Web Serial 是否可用：以 navigator.serial 是否存在判定（Chrome/Edge 系支持） */
export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

/** 是否处于安全上下文：串口 API 仅在 HTTPS / localhost 下开放 */
export function isSecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === true
}
