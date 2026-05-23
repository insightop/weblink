import type { BridgeBackend } from "../infrastructure/bridges/BridgeBackend";
import type { WebUsbSession } from "../infrastructure/usb/WebUsbSession";
import type { WebHidSession } from "../infrastructure/hid/WebHidSession";

/** 主机侧桥实现 id（一种协议栈实现；命名沿用计划里程碑） */
export type BridgeBackendId =
  | "ch341-vendor-bulk"
  | "ftdi-mpsse-ft232h"
  /** 标准 CP2130 固件为 Vendor/Bulk SPI；矩阵 id 保留计划中的 hid 后缀 */
  | "silabs-cp2130-hid"
  | "silabs-cp2112-hid";

export type BusKind = "spi" | "i2c";

export type TransportKind = "webusb" | "webhid";

export interface MatrixCell {
  readonly bridgeBackendId: BridgeBackendId;
  readonly bus: BusKind;
  readonly label: string;
  readonly transport: TransportKind;
  readonly usbFilters?: readonly USBDeviceFilter[];
  readonly hidFilters?: readonly HIDDeviceFilter[];
}

export interface RegisteredUsbBridge {
  readonly transport: "webusb";
  readonly id: BridgeBackendId;
  readonly displayName: string;
  readonly supportedBuses: readonly BusKind[];
  readonly usbFilters: readonly USBDeviceFilter[];
  readonly createUsb: (session: WebUsbSession) => BridgeBackend;
}

export interface RegisteredHidBridge {
  readonly transport: "webhid";
  readonly id: BridgeBackendId;
  readonly displayName: string;
  readonly supportedBuses: readonly BusKind[];
  readonly hidFilters: readonly HIDDeviceFilter[];
  readonly createHid: (session: WebHidSession) => BridgeBackend;
}

export type RegisteredBridge = RegisteredUsbBridge | RegisteredHidBridge;
