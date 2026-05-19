import { describe, expect, it } from "vitest";
import { ErrorCode, isDownloadError, isUserCancelledError } from "@/core/errors/ErrorCode";

describe("download error guards", () => {
  it("detects UserCancelled", () => {
    const e = { code: ErrorCode.UserCancelled, userMessage: "x" };
    expect(isDownloadError(e)).toBe(true);
    expect(isUserCancelledError(e)).toBe(true);
  });

  it("rejects non-user cancel", () => {
    const e = { code: ErrorCode.FlashFailed, userMessage: "x" };
    expect(isUserCancelledError(e)).toBe(false);
  });
});
