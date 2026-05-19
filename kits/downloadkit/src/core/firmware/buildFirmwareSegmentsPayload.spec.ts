import { describe, expect, it } from "vitest";
import { buildFirmwareSegmentsPayload } from "@/core/firmware/buildFirmwareSegmentsPayload";
import type { FirmwareRowDraft } from "@/core/firmware/firmwareRowDraft";
import { stm32FixedAddressPolicy, stm32UserAddressPolicy, esp32SerialPolicy } from "@/plugins/firmwareInputPresets";

function makeBinFile(bytes: number[]): File {
  const buf = new Uint8Array(bytes);
  return new File([buf], "app.bin", { type: "application/octet-stream" });
}

describe("buildFirmwareSegmentsPayload", () => {
  it("builds single STM32 segment with fixed-address policy (read-only UI; resolve from default)", async () => {
    const rowId = "row-fixed";
    const rows: FirmwareRowDraft[] = [
      { rowId, file: makeBinFile([9, 8]), addressStr: "0x08000000", note: "" },
    ];
    const out = await buildFirmwareSegmentsPayload({
      chipFamily: "stm32",
      policy: stm32FixedAddressPolicy,
      rows,
    });
    expect(out.items).toHaveLength(1);
    expect(out.items[0].address).toBe(0x0800_0000);
    expect([...out.items[0].data]).toEqual([9, 8]);
  });

  it("builds single STM32 segment with default address", async () => {
    const rowId = "row-1";
    const rows: FirmwareRowDraft[] = [
      { rowId, file: makeBinFile([1, 2, 3]), addressStr: "", note: "" },
    ];
    const out = await buildFirmwareSegmentsPayload({
      chipFamily: "stm32",
      policy: stm32UserAddressPolicy,
      rows,
    });
    expect(out.items).toHaveLength(1);
    expect(out.items[0].slotId).toBe(rowId);
    expect(out.items[0].address).toBe(0x0800_0000);
    expect([...out.items[0].data]).toEqual([1, 2, 3]);
  });

  it("rejects HEX when multi-row policy disallows", async () => {
    const hexText = [":020000040800F2", ":10000000000102030405060708090A0B0C0D0E0F78", ":00000001FF"].join("\n");
    const hexFile = new File([hexText], "a.hex", { type: "text/plain" });
    const rows: FirmwareRowDraft[] = [
      { rowId: "a", file: hexFile, addressStr: "0x1000", note: "" },
      { rowId: "b", file: makeBinFile([9]), addressStr: "0x20000", note: "" },
    ];
    await expect(
      buildFirmwareSegmentsPayload({
        chipFamily: "esp32",
        policy: esp32SerialPolicy,
        rows,
      }),
    ).rejects.toThrow(/HEX_NOT_ALLOWED_MULTI_SLOT/);
  });

  it("throws when no files", async () => {
    const rows: FirmwareRowDraft[] = [{ rowId: "x", file: null, addressStr: "", note: "" }];
    await expect(
      buildFirmwareSegmentsPayload({
        chipFamily: "stm32",
        policy: stm32UserAddressPolicy,
        rows,
      }),
    ).rejects.toThrow(/NO_FIRMWARE_SEGMENTS/);
  });
});
