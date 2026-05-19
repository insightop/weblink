import { describe, expect, it, vi } from "vitest";
import type { SerialTransport } from "@/transports/types";
import { Ch32SerialProtocol } from "@/protocols/ch32/serial/Ch32SerialProtocol";

function mkTransport(): SerialTransport {
  return {
    name: "web-serial",
    open: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    write: vi.fn(async () => undefined),
    read: vi.fn(async () => new Uint8Array()),
    getPort: vi.fn(() => ({}) as SerialPort),
  };
}

describe("Ch32SerialProtocol", () => {
  it("buildPlan accepts single-bin payload", async () => {
    const protocol = new Ch32SerialProtocol(mkTransport());
    const plan = await protocol.buildPlan({
      chipFamily: "ch32",
      flasherType: "serial",
      firmware: { kind: "single-bin", items: [{ address: 0x0800_0000, data: new Uint8Array([1, 2, 3]) }] },
    });
    expect(plan.chipFamily).toBe("ch32");
    expect(plan.segments[0].address).toBe(0x0800_0000);
    expect(plan.segments[0].data.byteLength).toBe(3);
  });

  it("buildPlan throws when firmware segments are empty", async () => {
    const protocol = new Ch32SerialProtocol(mkTransport());
    await expect(
      protocol.buildPlan({
        chipFamily: "ch32",
        flasherType: "serial",
        firmware: { kind: "segments", items: [] },
      }),
    ).rejects.toMatchObject({ code: "FLASH_PLAN_INVALID" });
  });
});
