import { describe, expect, it } from "vitest";
import { createLineAccumulator } from "./line-reader.js";

describe("createLineAccumulator", () => {
  it("splits CRLF", () => {
    const a = createLineAccumulator();
    expect(a.push("a\r\nb\r\nc\n")).toEqual(["a", "b", "c"]);
  });

  it("splits LF", () => {
    const a = createLineAccumulator();
    expect(a.push("x\ny\nz\n")).toEqual(["x", "y", "z"]);
  });

  it("flushRemainder", () => {
    const a = createLineAccumulator();
    expect(a.push("noeol")).toEqual([]);
    expect(a.flushRemainder()).toBe("noeol");
  });
});
