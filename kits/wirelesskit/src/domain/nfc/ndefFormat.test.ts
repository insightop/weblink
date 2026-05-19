import { describe, expect, it } from "vitest";
import { formatNdefMessage } from "@/domain/nfc/ndefFormat";

describe("ndefFormat", () => {
  it("formats empty message", () => {
    const vm = formatNdefMessage({ records: [] });
    expect(vm.recordCount).toBe(0);
    expect(vm.records).toEqual([]);
  });

  it("formats url record best-effort", () => {
    const bytes = new TextEncoder().encode("https://example.com");
    const msg = {
      records: [
        {
          recordType: "url",
          data: new DataView(bytes.buffer),
        },
      ],
    };
    const vm = formatNdefMessage(msg as unknown as NDEFMessage);
    expect(vm.recordCount).toBe(1);
    expect(vm.records[0]?.recordType).toBe("url");
  });
});

