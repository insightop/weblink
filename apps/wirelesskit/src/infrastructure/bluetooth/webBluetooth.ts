export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function isSecureContextForBluetooth(): boolean {
  return typeof window !== "undefined" && window.isSecureContext === true;
}

