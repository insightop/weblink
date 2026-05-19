import { describe, expect, it } from "vitest";
import { LineFramer } from "./framing";

describe("LineFramer", () => {
  it("splits lines across chunks", () => {
    const f = new LineFramer();
    expect(f.push("a")) .toEqual([]);
    expect(f.push("b\n")) .toEqual(["ab"]);
  });

  it("handles CRLF", () => {
    const f = new LineFramer();
    expect(f.push("x\r\n")) .toEqual(["x"]);
  });
});
