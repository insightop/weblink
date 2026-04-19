import { describe, expect, it } from "vitest";
import { isGsvSentenceArrayComplete } from "./pipeline.js";

describe("isGsvSentenceArrayComplete", () => {
  it("returns false until all message numbers 1..total are present", () => {
    const mk = (total, index) => ({ fields: [String(total), String(index), "4"] });
    expect(isGsvSentenceArrayComplete([mk(3, 1)])).toBe(false);
    expect(isGsvSentenceArrayComplete([mk(3, 1), mk(3, 2)])).toBe(false);
    expect(isGsvSentenceArrayComplete([mk(3, 1), mk(3, 2), mk(3, 3)])).toBe(
      true,
    );
  });

  it("returns false when total is unknown", () => {
    expect(isGsvSentenceArrayComplete([{ fields: ["", "1", "4"] }])).toBe(
      false,
    );
  });
});
