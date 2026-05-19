import { describe, expect, it } from "vitest";
import { transitionStage } from "@/core/stateMachine/downloadMachine";

describe("downloadMachine", () => {
  it("rejects illegal transition", () => {
    expect(() => transitionStage("idle", "FLASH_OK")).toThrow(/Invalid transition/);
  });

  it("supports happy path transitions", () => {
    const s1 = transitionStage("idle", "SELECT_FIRMWARE");
    const s2 = transitionStage(s1, "START");
    const s3 = transitionStage(s2, "CONNECT_OK");
    expect(s3).toBe("probingTarget");
  });
});
