import { describe, it, expect } from "vitest";
import { generateId } from "./id";

describe("generateId", () => {
  it("should generate an ID of default length 8", () => {
    const id = generateId();
    expect(id).toHaveLength(8);
  });

  it("should generate an ID of specified length", () => {
    expect(generateId(4)).toHaveLength(4);
    expect(generateId(16)).toHaveLength(16);
  });

  it("should only contain valid characters (no ambiguous 0/O/1/l/I)", () => {
    const validChars = /^[ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]+$/;
    for (let i = 0; i < 50; i++) {
      expect(generateId()).toMatch(validChars);
    }
  });

  it("should generate unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    // With 53^8 possible combinations, collisions in 100 samples are virtually impossible
    expect(ids.size).toBe(100);
  });
});
