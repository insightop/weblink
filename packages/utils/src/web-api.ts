export type WebApiName = "serial" | "usb" | "hid" | "bluetooth" | "nfc" | "media";

export function isSecureContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

export function isWebApiSupported(api: WebApiName): boolean {
  if (typeof navigator === "undefined") return false;
  switch (api) {
    case "serial":
      return "serial" in navigator;
    case "usb":
      return "usb" in navigator;
    case "hid":
      return "hid" in navigator;
    case "bluetooth":
      return "bluetooth" in navigator;
    case "nfc":
      return "nfc" in navigator;
    case "media":
      return "mediaDevices" in navigator;
  }
}

export function assertSecureContext(): void {
  if (!isSecureContext()) {
    throw new Error("HTTPS or localhost (secure context) is required.");
  }
}

export function assertWebApiSupported(api: WebApiName): void {
  if (!isWebApiSupported(api)) {
    throw new Error(
      `Web ${api} is not supported. Please use a Chromium-based browser with HTTPS or localhost.`,
    );
  }
}
