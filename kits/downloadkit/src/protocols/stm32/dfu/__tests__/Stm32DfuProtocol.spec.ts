import { describe, expect, it, vi } from "vitest";
import type { UsbTransport } from "@/transports/types";
import { Stm32DfuProtocol } from "@/protocols/stm32/dfu/Stm32DfuProtocol";

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

describe("Stm32DfuProtocol", () => {
  it("buildPlan accepts single-bin", async () => {
    const p = new Stm32DfuProtocol(mkTransport());
    const plan = await p.buildPlan({
      chipFamily: "stm32",
      flasherType: "usb-dfu",
      firmware: { kind: "single-bin", items: [{ address: 0x08000000, data: new Uint8Array([1, 2]) }] },
    });
    expect(plan.segments[0].address).toBe(0x08000000);
    expect(plan.segments[0].data.byteLength).toBe(2);
  });

  it("buildPlan uses app segment from legacy multi-image", async () => {
    const p = new Stm32DfuProtocol(mkTransport());
    const plan = await p.buildPlan({
      chipFamily: "stm32",
      flasherType: "usb-dfu",
      firmware: {
        kind: "multi-image",
        bootloader: { address: 0x1000, data: new Uint8Array([9]) },
        partitionTable: { address: 0x8000, data: new Uint8Array([8]) },
        app: { address: 0x0800_4000, data: new Uint8Array([1, 2]) },
      },
    });
    expect(plan.segments[0].address).toBe(0x0800_4000);
    expect(plan.segments[0].data.byteLength).toBe(2);
  });

  it("write reports progress from adapter", async () => {
    const p = new Stm32DfuProtocol(mkTransport());
    const adapter = (p as unknown as { adapter: { eraseAndWrite: (args: { onProgress: (written: number, total: number) => void }) => Promise<void> } }).adapter;
    adapter.eraseAndWrite = vi.fn(async ({ onProgress }) => {
      onProgress(2, 4);
      onProgress(4, 4);
    });

    const progress: number[] = [];
    await p.write(
      { chipFamily: "stm32", segments: [{ address: 0x08000000, data: new Uint8Array([1, 2, 3, 4]) }] },
      (s) => progress.push(s.totalPercent),
    );

    expect(progress.includes(50)).toBe(true);
    expect(progress[progress.length - 1]).toBe(100);
  });
});
