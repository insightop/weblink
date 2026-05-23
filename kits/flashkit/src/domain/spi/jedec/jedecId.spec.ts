import { describe, expect, it } from "vitest";
import { formatJedecId, parseJedecId } from "./jedecId";

describe("jedecId", () => {
  it("parses and formats", () => {
    const id = parseJedecId(new Uint8Array([0xef, 0x40, 0x16]));
    expect(formatJedecId(id)).toBe("EF 40 16");
  });
});
