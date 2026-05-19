import { describe, expect, it, vi } from "vitest";
import { createDaplinkAdapter } from "@/transports/adapters/daplink.adapter";
import type { UsbTransport } from "@/transports/types";

function mockUsbTransport(getDeviceImpl: () => USBDevice): UsbTransport {
  return {
    name: "mock-usb",
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    write: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValue(new Uint8Array(0)),
    getDevice: vi.fn(getDeviceImpl),
  };
}

describe("createDaplinkAdapter", () => {
  it("connect propagates error when transport has no device after open", async () => {
    const transport = mockUsbTransport(() => {
      throw new Error("USB device is not opened");
    });
    const adapter = createDaplinkAdapter(transport);
    await expect(adapter.connect()).rejects.toThrow(/USB device is not opened/);
  });

  it("flash propagates error when getDevice fails", async () => {
    const transport = mockUsbTransport(() => {
      throw new Error("USB device is not opened");
    });
    const adapter = createDaplinkAdapter(transport);
    await expect(adapter.flash(new Uint8Array([1]))).rejects.toThrow(/USB device is not opened/);
  });
});
