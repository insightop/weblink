import type { BrowserCapabilities } from "@/plugins/types";

export function detectBrowserCapabilities(): BrowserCapabilities {
  if (typeof navigator === "undefined") {
    return { webSerial: false, webUsb: false, webHid: false };
  }
  return {
    webSerial: "serial" in navigator,
    webUsb: "usb" in navigator,
    webHid: "hid" in navigator,
  };
}

export function getBrowserSupportHint(capabilities: BrowserCapabilities): string {
  if (capabilities.webSerial || capabilities.webUsb || capabilities.webHid) {
    return "当前浏览器仅部分支持硬件接口，请切换可用模式或使用最新版 Chrome/Edge/Arc。";
  }
  return "当前浏览器不支持 WebSerial/WebUSB/WebHID。请使用最新版 Chrome、Edge 或 Arc。";
}
