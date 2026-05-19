import { describe, expect, it } from "vitest";
import { WebApiError, toWebApiError } from "./error";

describe("WebApiError", () => {
  it("has code and message", () => {
    const err = new WebApiError("not_supported", "Not supported");
    expect(err.code).toBe("not_supported");
    expect(err.message).toBe("Not supported");
    expect(err.name).toBe("WebApiError");
  });

  it("preserves cause", () => {
    const cause = new Error("root cause");
    const err = new WebApiError("open_failed", "Failed", { cause });
    expect(err.cause).toBe(cause);
  });
});

describe("toWebApiError", () => {
  it("returns WebApiError as-is", () => {
    const original = new WebApiError("read_failed", "Read failed");
    expect(toWebApiError(original, { code: "unknown", message: "fallback" })).toBe(original);
  });

  it("maps Error to WebApiError with fallback code", () => {
    const err = new Error("something broke");
    const result = toWebApiError(err, { code: "write_failed", message: "Write failed" });
    expect(result.code).toBe("write_failed");
    expect(result.message).toBe("something broke");
  });

  it("maps unknown values to WebApiError", () => {
    const result = toWebApiError("string error", { code: "unknown", message: "Unknown" });
    expect(result.code).toBe("unknown");
    expect(result.message).toBe("Unknown");
  });
});
