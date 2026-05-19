import { describe, expect, it } from "vitest";
import { normalizeFirmwareToSegments } from "@/core/firmware/normalizeFirmwareToSegments";

describe("normalizeFirmwareToSegments", () => {
  it("passes through segments kind", () => {
    const items = [{ slotId: "app", address: 0x10000, data: new Uint8Array([1]) }];
    expect(normalizeFirmwareToSegments({ kind: "segments", items })).toEqual(items);
  });

  it("maps single-bin to slot payloads", () => {
    const data = new Uint8Array([2]);
    const out = normalizeFirmwareToSegments({
      kind: "single-bin",
      items: [{ address: 0x08000000, data, label: "app" }],
    });
    expect(out[0]).toMatchObject({ slotId: "app", address: 0x08000000, data });
  });

  it("maps multi-image to ordered slot payloads", () => {
    const out = normalizeFirmwareToSegments({
      kind: "multi-image",
      bootloader: { address: 0x1000, data: new Uint8Array([1]) },
      partitionTable: { address: 0x8000, data: new Uint8Array([2]) },
      app: { address: 0x10000, data: new Uint8Array([3]) },
    });
    expect(out.map((s) => s.slotId)).toEqual(["bootloader", "partition-table", "app"]);
  });
});
