import type { MatrixCell } from "../types";

/** FT232H 单通道 MPSSE（常见 PID 0x6014） */
export const ftdiMpsseMatrixCells: MatrixCell[] = [
  {
    bridgeBackendId: "ftdi-mpsse-ft232h",
    bus: "spi",
    label: "FT232H · SPI (MPSSE)",
    transport: "webusb",
    usbFilters: [{ vendorId: 0x0403, productId: 0x6014 }],
  },
];
