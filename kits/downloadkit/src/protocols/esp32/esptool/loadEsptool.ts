/**
 * Runtime entry for esptool-js — dynamic import so the vendor chunk can be split
 * from the main bundle (ESP32 flash path only).
 */
export function loadEsptool(): Promise<typeof import("esptool-js")> {
  return import("esptool-js");
}
