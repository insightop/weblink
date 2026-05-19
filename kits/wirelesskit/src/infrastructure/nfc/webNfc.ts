export function isWebNfcSupported(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

export function isSecureContextForNfc(): boolean {
  return typeof window !== "undefined" && window.isSecureContext === true;
}

