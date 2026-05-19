import { describe, expect, it, vi } from "vitest";
import type { UsbTransport } from "@/transports/types";
import { Gd32DfuProtocol } from "@/protocols/gd32/dfu/Gd32DfuProtocol";

function mkTransport(): UsbTransport {
  return {
    name: "web-usb",
    open: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    write: vi.fn(async () => undefined),
    read: vi.fn(async () => new Uint8Array()),
    getDevice: vi.fn(() => ({}) as USBDevice),
  };
}

describe("Gd32DfuProtocol", () => {
  it("buildPlan accepts single-bin payload", async () => {
    const protocol = new Gd32DfuProtocol(mkTransport());
    const plan = await protocol.buildPlan({
      chipFamily: "gd32",
      flasherType: "usb-dfu",
      firmware: { kind: "single-bin", items: [{ address: 0x08000000, data: new Uint8Array([1, 2]) }] },
    });
    expect(plan.chipFamily).toBe("gd32");
    expect(plan.segments[0].address).toBe(0x08000000);
  });

  it("maps adapter write errors to download error", async () => {
    const protocol = new Gd32DfuProtocol(mkTransport());
    const adapter = (
      protocol as unknown as {
        adapter: {
          eraseAndWrite: (args: { onProgress: (written: number, total: number) => void }) => Promise<void>;
        };
      }
    ).adapter;
    adapter.eraseAndWrite = vi.fn(async () => {
      throw new Error("boom");
    });

    await expect(
      protocol.write(
        { chipFamily: "gd32", segments: [{ address: 0x08000000, data: new Uint8Array([1, 2, 3, 4]) }] },
        () => undefined,
      ),
    ).rejects.toMatchObject({ code: "FLASH_FAILED" });
  });
});
