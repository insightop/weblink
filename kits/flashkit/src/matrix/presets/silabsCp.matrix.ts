import type { MatrixCell } from "@/matrix/types";

/**
 * CP2130：标准固件为 Vendor/Bulk（与 `silabs-cp2130-hid` 注册 id 对应，实现走 WebUSB）。
 * CP2112：纯 HID SMBus 桥。
 */
export const silabsCpMatrixCells: MatrixCell[] = [
  {
    bridgeBackendId: "silabs-cp2130-hid",
    bus: "spi",
    label: "CP2130 · SPI (Vendor)",
    transport: "webusb",
    usbFilters: [{ vendorId: 0x10c4, productId: 0x87a0 }],
  },
  {
    bridgeBackendId: "silabs-cp2112-hid",
    bus: "i2c",
    label: "CP2112 · I²C (HID)",
    transport: "webhid",
    hidFilters: [{ vendorId: 0x10c4, productId: 0xea90 }],
  },
];
