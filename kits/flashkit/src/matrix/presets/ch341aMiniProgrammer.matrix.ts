import type { MatrixCell } from "@/matrix/types";

/** 常见黑色 CH341A USB 编程器：SPI/I²C 模式 PID 0x5512 */
export const ch341aMiniProgrammerCells: MatrixCell[] = [
  {
    bridgeBackendId: "ch341-vendor-bulk",
    bus: "spi",
    label: "CH341A · SPI",
    transport: "webusb",
    usbFilters: [{ vendorId: 0x1a86, productId: 0x5512 }],
  },
  {
    bridgeBackendId: "ch341-vendor-bulk",
    bus: "i2c",
    label: "CH341A · I²C",
    transport: "webusb",
    usbFilters: [{ vendorId: 0x1a86, productId: 0x5512 }],
  },
];
