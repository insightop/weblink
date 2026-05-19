import { describe, expect, it } from "vitest";
import type { StlinkTargetVariant } from "@/transports/adapters/stlink.adapter";
import {
  createStlinkTargetSession,
  signatureForCandidates,
  tryAutoPickTarget,
} from "@/features/flasher/services/stlinkTargetPreference";

const mk = (type: string): StlinkTargetVariant => ({
  type,
  freq: 168,
  flash_size: 512,
  sram_size: 128,
});

describe("stlinkTargetPreference (session memory)", () => {
  it("returns null when no session", () => {
    expect(tryAutoPickTarget(null, [mk("STM32F103")])).toBeNull();
  });

  it("auto-picks when signature matches", () => {
    const list = [mk("STM32F103"), mk("STM32F407")];
    const session = createStlinkTargetSession(list, "STM32F407");
    expect(tryAutoPickTarget(session, list)).toBe("STM32F407");
    expect(signatureForCandidates(list)).toBeTruthy();
  });

  it("returns null when candidate set changed", () => {
    const a = [mk("STM32F103"), mk("STM32F407")];
    const session = createStlinkTargetSession(a, "STM32F407");
    expect(tryAutoPickTarget(session, [mk("STM32F103")])).toBeNull();
  });
});
