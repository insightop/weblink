import { describe, expect, it } from "vitest";
import { ErrorCode } from "@/core/errors/ErrorCode";
import {
  mapDfuProbeError,
  mapDfuResetError,
  mapDfuSyncError,
  mapDfuWriteError,
} from "@/protocols/stm32/dfu/adapters/DfuErrorMapper";

describe("DfuErrorMapper", () => {
  it("maps probe error", () => {
    const err = mapDfuProbeError(new Error("x"));
    expect(err.code).toBe(ErrorCode.ProbeFailed);
    expect(err.userMessage.length).toBeGreaterThan(0);
  });

  it("maps sync/write/reset errors", () => {
    expect(mapDfuSyncError("a").code).toBe(ErrorCode.SyncFailed);
    expect(mapDfuWriteError("b").code).toBe(ErrorCode.FlashFailed);
    expect(mapDfuResetError("c").code).toBe(ErrorCode.ResetFailed);
  });
});
