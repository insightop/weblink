import { describe, expect, it } from "vitest";
import { downloadTaskInputToEsp32ImageInput } from "@/protocols/esp32/imagePlan/downloadTaskInputToEsp32ImageInput";
import type { DownloadTaskInput } from "@/core/types/download";

function baseTask(): Omit<DownloadTaskInput, "firmware"> {
  return { flasherType: "serial", chipFamily: "esp32" };
}

describe("downloadTaskInputToEsp32ImageInput", () => {
  it("maps single-bin DownloadTaskInput to Esp32ImageInput", () => {
    const data = new Uint8Array([1, 2, 3]);
    const task: DownloadTaskInput = {
      ...baseTask(),
      firmware: {
        kind: "single-bin",
        items: [{ address: 0x10000, data, label: "app" }],
      },
    };
    const esp = downloadTaskInputToEsp32ImageInput(task);
    expect(esp).toEqual({
      kind: "single-bin",
      address: 0x10000,
      data,
      label: "app",
    });
  });

  it("throws when single-bin has no items", () => {
    const task: DownloadTaskInput = {
      ...baseTask(),
      firmware: { kind: "single-bin", items: [] },
    };
    expect(() => downloadTaskInputToEsp32ImageInput(task)).toThrow(/no segments/i);
  });

  it("accepts kind segments for single app", () => {
    const data = new Uint8Array([4, 5]);
    const task: DownloadTaskInput = {
      ...baseTask(),
      firmware: {
        kind: "segments",
        items: [{ slotId: "app", address: 0x10000, data, label: "app" }],
      },
    };
    const esp = downloadTaskInputToEsp32ImageInput(task);
    expect(esp).toEqual({ kind: "single-bin", address: 0x10000, data, label: "app" });
  });

  it("throws for multi-segment (use buildPlanFromSegmentPayloads)", () => {
    const task: DownloadTaskInput = {
      ...baseTask(),
      firmware: {
        kind: "segments",
        items: [
          { slotId: "a", address: 0x1000, data: new Uint8Array([1]), label: "a" },
          { slotId: "b", address: 0x20000, data: new Uint8Array([2]), label: "b" },
        ],
      },
    };
    expect(() => downloadTaskInputToEsp32ImageInput(task)).toThrow(/buildPlanFromSegmentPayloads/);
  });
});
