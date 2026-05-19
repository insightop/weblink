import { describe, expect, it } from "vitest";
import { resolveMatrixCell } from "./workbenchAdapterUi";
import type { MatrixCell } from "@/matrix/types";

const mockCells: MatrixCell[] = [
  {
    bridgeBackendId: "ch341-vendor-bulk",
    bus: "spi",
    label: "",
    transport: "webusb",
    usbFilters: [],
  },
  {
    bridgeBackendId: "ftdi-mpsse-ft232h",
    bus: "spi",
    label: "",
    transport: "webusb",
    usbFilters: [],
  },
];

describe("workbenchAdapterUi", () => {
  it("resolves ch341 spi", () => {
    const c = resolveMatrixCell(mockCells, "ch341", "spi");
    expect(c?.bridgeBackendId).toBe("ch341-vendor-bulk");
  });

  it("returns undefined for ft232h i2c when not in matrix", () => {
    expect(resolveMatrixCell(mockCells, "ft232h", "i2c")).toBeUndefined();
  });
});
