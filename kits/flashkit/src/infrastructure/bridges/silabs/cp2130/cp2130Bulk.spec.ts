import { describe, expect, it } from "vitest";
import { packCp2130BulkWriteRead } from "./cp2130Bulk";

describe("cp2130Bulk", () => {
  it("packs write-read header and payload", () => {
    const p = new Uint8Array([1, 2, 3]);
    const buf = packCp2130BulkWriteRead(p);
    expect(buf[2]).toBe(0x02);
    expect(buf.byteLength).toBe(8 + 3);
    const le = new DataView(buf.buffer, buf.byteOffset + 4, 4).getUint32(0, true);
    expect(le).toBe(3);
    expect(buf[8]).toBe(1);
    expect(buf[9]).toBe(2);
    expect(buf[10]).toBe(3);
  });
});
