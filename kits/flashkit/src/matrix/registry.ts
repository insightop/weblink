import type { RegisteredBridge, BridgeBackendId, BusKind } from "./types";
import { FlashKitError, FlashKitErrorCode } from "../domain/errors/FlashKitError";
import { createCh341VendorBulkBridge } from "../infrastructure/bridges/ch341/createCh341VendorBulkBridge";
import { createFtdiMpsseFt232hBridge } from "../infrastructure/bridges/ftdi/createFtdiMpsseFt232hBridge";
import { createSilabsCp2130Bridge } from "../infrastructure/bridges/silabs/cp2130/createSilabsCp2130Bridge";
import { createSilabsCp2112Bridge } from "../infrastructure/bridges/silabs/cp2112/createSilabsCp2112Bridge";
import type { WebUsbSession } from "../infrastructure/usb/WebUsbSession";
import type { WebHidSession } from "../infrastructure/hid/WebHidSession";

const registry = new Map<BridgeBackendId, RegisteredBridge>();

export function registerBridge(entry: RegisteredBridge): void {
  registry.set(entry.id, entry);
}

export function getBridge(id: BridgeBackendId): RegisteredBridge | undefined {
  return registry.get(id);
}

export function listBridges(): RegisteredBridge[] {
  return [...registry.values()];
}

export function assertBusSupported(id: BridgeBackendId, bus: BusKind): void {
  const b = registry.get(id);
  if (!b) {
    throw new FlashKitError(FlashKitErrorCode.BRIDGE_NOT_SUPPORTED, `Unknown bridge: ${id}`);
  }
  if (!b.supportedBuses.includes(bus)) {
    throw new FlashKitError(
      FlashKitErrorCode.BUS_NOT_SUPPORTED,
      `Bridge ${id} does not support bus ${bus}`,
    );
  }
}

export function resolveBridgeForUsbDevice(device: USBDevice): RegisteredBridge | undefined {
  const vid = device.vendorId;
  const pid = device.productId;
  for (const b of registry.values()) {
    if (b.transport !== "webusb") continue;
    for (const f of b.usbFilters) {
      if (f.vendorId !== undefined && f.vendorId !== vid) continue;
      if (f.productId !== undefined && f.productId !== pid) continue;
      return b;
    }
  }
  return undefined;
}

export function resolveBridgeForHidDevice(device: HIDDevice): RegisteredBridge | undefined {
  const vid = device.vendorId;
  const pid = device.productId;
  for (const b of registry.values()) {
    if (b.transport !== "webhid") continue;
    for (const f of b.hidFilters) {
      if (f.vendorId !== undefined && f.vendorId !== vid) continue;
      if (f.productId !== undefined && f.productId !== pid) continue;
      return b;
    }
  }
  return undefined;
}

export function initMatrixRegistry(): void {
  registerBridge({
    transport: "webusb",
    id: "ch341-vendor-bulk",
    displayName: "CH341A (Vendor Bulk)",
    supportedBuses: ["spi", "i2c"],
    usbFilters: [{ vendorId: 0x1a86, productId: 0x5512 }],
    createUsb: (session: WebUsbSession) => createCh341VendorBulkBridge(session),
  });

  registerBridge({
    transport: "webusb",
    id: "ftdi-mpsse-ft232h",
    displayName: "FTDI FT232H (MPSSE SPI)",
    supportedBuses: ["spi"],
    usbFilters: [{ vendorId: 0x0403, productId: 0x6014 }],
    createUsb: (session: WebUsbSession) => createFtdiMpsseFt232hBridge(session),
  });

  registerBridge({
    transport: "webusb",
    id: "silabs-cp2130-hid",
    displayName: "Silicon Labs CP2130 (Vendor SPI)",
    supportedBuses: ["spi"],
    usbFilters: [{ vendorId: 0x10c4, productId: 0x87a0 }],
    createUsb: (session: WebUsbSession) => createSilabsCp2130Bridge(session),
  });

  registerBridge({
    transport: "webhid",
    id: "silabs-cp2112-hid",
    displayName: "Silicon Labs CP2112 (HID SMBus/I²C)",
    supportedBuses: ["i2c"],
    hidFilters: [{ vendorId: 0x10c4, productId: 0xea90 }],
    createHid: (session: WebHidSession) => createSilabsCp2112Bridge(session),
  });
}
