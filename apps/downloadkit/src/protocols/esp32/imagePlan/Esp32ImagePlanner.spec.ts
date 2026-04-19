import { describe, expect, it } from "vitest";
import { Esp32ImagePlanner } from "@/protocols/esp32/imagePlan/Esp32ImagePlanner";

describe("Esp32ImagePlanner", () => {
  it("builds single bin plan with default app address", () => {
    const planner = new Esp32ImagePlanner();
    const plan = planner.buildPlan({
      kind: "single-bin",
      data: new Uint8Array([1, 2, 3]),
    });
    expect(plan.segments[0].address).toBe(0x10000);
  });

  it("rejects overlapping segments", () => {
    const planner = new Esp32ImagePlanner();
    expect(() =>
      planner.buildPlan({
        kind: "multi-image",
        bootloader: new Uint8Array(0x9000),
        partitionTable: new Uint8Array([1]),
        app: new Uint8Array([1]),
      }),
    ).toThrow(/overlap/i);
  });

  it("buildPlanFromSegmentPayloads sorts by address", () => {
    const planner = new Esp32ImagePlanner();
    const plan = planner.buildPlanFromSegmentPayloads([
      { slotId: "b", address: 0x20000, data: new Uint8Array([2]), label: "b" },
      { slotId: "a", address: 0x1000, data: new Uint8Array([1]), label: "a" },
    ]);
    expect(plan.segments.map((s) => s.address)).toEqual([0x1000, 0x20000]);
  });
});
